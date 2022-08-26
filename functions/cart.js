const product = require("./product");
const Product = Parse.Object.extend("Product");
const CartItem = Parse.Object.extend("CartItem");

Parse.Cloud.define("add-item-to-cart", async (req) => {
  if (req.user == null) throw "INVALID_USER";
  if (req.params.productId == null) throw "INVALID_PRODUCT";
  if (
    req.params.quantity == null ||
    req.params.quantity < 0 ||
    req.params.quantity > 1000
  )
    throw "INVALID_QUANTITY";

  const product = new Product();
  product.id = req.params.productId;

  const user = new Parse.User();
  const cartItem = new CartItem();

  cartItem.set("quantity", req.params.quantity);
  cartItem.set("product", product);
  cartItem.set("user", req.user);

  const savedItem = await cartItem.save(null, { useMasterKey: true });

  return {
    id: savedItem.id,
  };
});

Parse.Cloud.define("modify-item-quantity", async (req) => {
  if (req.user == null) throw "INVALID_USER";
  if (req.params.cartItemId == null) throw "INVALID_CART_ITEM";
  if (req.params.quantity == null) throw "INVALID_QUANTITY";

  const cartItem = new CartItem();
  cartItem.id = req.params.cartItemId;
  if (req.params.quantity > 0) {
    cartItem.set("quantity", req.params.quantity);
    await cartItem.save(null, { useMasterKey: true });
  } else {
    await cartItem.destroy({ useMasterKey: true });
  }
});

Parse.Cloud.define("get-cart-items", async (req) => {
  if (req.user == null) throw "INVALID_USER";
  const queryCartItem = new Parse.Query("CartItem");
  queryCartItem.include("product");
  queryCartItem.include("product.category");
  queryCartItem.equalTo("user", req.user);

  const resultCartItem = await queryCartItem.find({ useMasterKey: true });
  return resultCartItem.map(function (c) {
    c = c.toJSON();
    return {
      id: c.objectId,
      quantity: c.quantity,
      product: product.formatProductJson(c.product),
    };
  });
});
