function fail(message, status=400){ const e=new Error(message); e.status=status; throw e; }

function ownerFromRequest(req){
  const customerId=req.customerUser?.id || null;
  const visitorKey=customerId ? null : String(req.get('x-zorqemi-visitor-key') || '').trim();
  if(!customerId && !/^[a-f0-9-]{20,100}$/i.test(visitorKey)) fail('authentication_or_visitor_required',400);
  return {customerId,visitorKey};
}

async function getOrCreateCart(client,{customerId,visitorKey,merchantId=null}){
  const where=customerId ? 'customer_id=$1 AND status=\'active\'' : 'visitor_key=$1 AND status=\'active\'';
  const r=await client.query(`SELECT * FROM carts WHERE ${where} ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,[customerId||visitorKey]);
  if(r.rows[0]) return r.rows[0];
  const created=await client.query(
    `INSERT INTO carts(customer_id,visitor_key,merchant_id) VALUES($1,$2,$3) RETURNING *`,
    [customerId,visitorKey,merchantId]
  );
  return created.rows[0];
}

export async function getCart(pool,req){
  const owner=ownerFromRequest(req);
  const client=await pool.connect();
  try{
    const cart=await getOrCreateCart(client,owner);
    const r=await client.query(
      `SELECT ci.id,ci.product_id,ci.variant_id,ci.quantity,
              p.name,p.description,p.price,p.stock,p.active,p.merchant_id,
              v.name AS variant_name,v.price AS variant_price,v.stock AS variant_stock,v.active AS variant_active,
              m.name AS merchant_name,m.shop_slug
         FROM cart_items ci
         JOIN products p ON p.id=ci.product_id
         JOIN merchants m ON m.id=p.merchant_id
         LEFT JOIN product_variants v ON v.id=ci.variant_id
        WHERE ci.cart_id=$1 ORDER BY ci.created_at`,[cart.id]);
    return {cart,items:r.rows};
  } finally { client.release(); }
}

export async function addCartItem(pool,req,body={}){
  const productId=body.productId ?? body.product_id;
  const variantId=body.variantId ?? body.variant_id;
  const quantity=body.quantity;
  const qty=Number(quantity);
  if(!Number.isInteger(qty)||qty<1||qty>99) fail('invalid_quantity',400);

  const normalizedProductId=String(productId ?? '').trim();
  if(!/^[0-9a-f-]{36}$/i.test(normalizedProductId)) fail('invalid_product_id',400);

  const normalizedVariantId=variantId==null||String(variantId).trim()==='' ? null : String(variantId).trim();
  if(normalizedVariantId && !/^[0-9a-f-]{36}$/i.test(normalizedVariantId)) fail('invalid_variant_id',400);

  const owner=ownerFromRequest(req);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');

    // Read the product without row locking. Stock is re-validated at checkout,
    // so cart insertion does not need to hold a product row lock here.
    console.log('cart product lookup', {
      productId: normalizedProductId,
      productIdJson: JSON.stringify(normalizedProductId),
      customerId: owner.customerId,
    });
    const product=await client.query(
      `SELECT p.id,p.merchant_id,p.active,p.stock
         FROM products p
        WHERE p.id::text=$1
        LIMIT 1`,
      [normalizedProductId]
    );
    console.log('cart product lookup result', {
      rowCount: product.rowCount,
      rows: product.rows.map(r => ({id:String(r.id),merchant_id:String(r.merchant_id),active:r.active,stock:r.stock}))
    });
    const row=product.rows[0];
    if(!row || row.active!==true) fail('product_unavailable',409);

    const merchant=await client.query(
      `SELECT id,published FROM merchants WHERE id=$1::uuid LIMIT 1`,
      [String(row.merchant_id)]
    );
    if(!merchant.rows[0] || merchant.rows[0].published!==true) fail('product_unavailable',409);

    let variant=null;
    if(normalizedVariantId){
      const variantResult=await client.query(
        `SELECT id,active,stock
           FROM product_variants
          WHERE id=$1::uuid AND product_id=$2::uuid
          LIMIT 1
          FOR UPDATE`,
        [normalizedVariantId,normalizedProductId]
      );
      variant=variantResult.rows[0];
      if(!variant || variant.active!==true) fail('product_unavailable',409);
    }

    const stock=variant?Number(variant.stock):Number(row.stock);
    if(qty>stock) fail('insufficient_stock',409);

    const cart=await getOrCreateCart(client,{...owner,merchantId:row.merchant_id});
    if(cart.merchant_id && String(cart.merchant_id)!==String(row.merchant_id)){
      await client.query('UPDATE carts SET merchant_id=NULL,updated_at=now() WHERE id=$1',[cart.id]);
    } else if(!cart.merchant_id) {
      await client.query('UPDATE carts SET merchant_id=$1,updated_at=now() WHERE id=$2',[row.merchant_id,cart.id]);
    }

    const existing=await client.query(
      'SELECT quantity FROM cart_items WHERE cart_id=$1 AND product_id=$2 AND variant_id IS NOT DISTINCT FROM $3 FOR UPDATE',
      [cart.id,row.id,normalizedVariantId]
    );
    const next=Number(existing.rows[0]?.quantity||0)+qty;
    if(next>stock) fail('insufficient_stock',409);

    if(existing.rows[0]) {
      await client.query(
        'UPDATE cart_items SET quantity=$1,updated_at=now() WHERE cart_id=$2 AND product_id=$3 AND variant_id IS NOT DISTINCT FROM $4',
        [next,cart.id,row.id,normalizedVariantId]
      );
    } else {
      await client.query(
        'INSERT INTO cart_items(cart_id,product_id,variant_id,quantity) VALUES($1,$2,$3,$4)',
        [cart.id,row.id,normalizedVariantId,qty]
      );
    }

    await client.query('UPDATE carts SET updated_at=now() WHERE id=$1',[cart.id]);
    await client.query('COMMIT');
    return getCart(pool,req);
  }catch(e){
    await client.query('ROLLBACK');
    throw e;
  }finally{
    client.release();
  }
}

export async function updateCartItem(pool,req,itemId,quantity){
  const qty=Number(quantity);
  if(!Number.isInteger(qty)||qty<1||qty>99) fail('invalid_quantity',400);
  const owner=ownerFromRequest(req);
  const client=await pool.connect();
  try{
    const ownerWhere=owner.customerId?'c.customer_id=$2':'c.visitor_key=$2';
    const r=await client.query(
      `SELECT ci.id,ci.product_id,ci.variant_id,p.stock,v.stock AS variant_stock
         FROM cart_items ci JOIN carts c ON c.id=ci.cart_id
         JOIN products p ON p.id=ci.product_id LEFT JOIN product_variants v ON v.id=ci.variant_id
        WHERE ci.id=$1 AND ${ownerWhere} AND c.status='active'`,[itemId,owner.customerId||owner.visitorKey]);
    if(!r.rows[0]) fail('cart_item_not_found',404);
    const row=r.rows[0],stock=Number(row.variant_id?row.variant_stock:row.stock);
    if(qty>stock) fail('insufficient_stock',409);
    await client.query('UPDATE cart_items SET quantity=$1,updated_at=now() WHERE id=$2',[qty,itemId]);
    return getCart(pool,req);
  }finally{client.release();}
}

export async function removeCartItem(pool,req,itemId){
  const owner=ownerFromRequest(req);
  const r=await pool.query(
    `DELETE FROM cart_items ci USING carts c
      WHERE ci.cart_id=c.id AND ci.id=$1 AND c.status='active' AND ${owner.customerId?'c.customer_id=$2':'c.visitor_key=$2'}
      RETURNING ci.id`,[itemId,owner.customerId||owner.visitorKey]);
  if(!r.rowCount) fail('cart_item_not_found',404);
  return getCart(pool,req);
}
