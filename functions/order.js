const product = require("./product");
const Order = Parse.Object.extend("Order");
const OrderItem = Parse.Object.extend("OrderItem");

Parse.Cloud.define("checkout", async (req) => {
  if (req.user == null) throw "INVALID_USER";
  const queryCartItem = new Parse.Query("CartItem");
  queryCartItem.equalTo("user", req.user);
  queryCartItem.include("product");

  const resultCartItem = await queryCartItem.find({ useMasterKey: true });

  let total = 0;

  for (let item of resultCartItem) {
    item = item.toJSON();
    total += item.quantity * item.product.price;
  }

  if (req.params.total != total) throw "INVALID_TOTAL";

  const order = new Order();
  order.set("total", total);
  order.set("user", req.user);
  const savedOrder = await order.save(null, { useMasterKey: true });

  for (let item of resultCartItem) {
    const orderItem = new OrderItem();

    orderItem.set("order", savedOrder);
    orderItem.set("user", req.user);
    orderItem.set("product", item.get("product"));
    orderItem.set("quantity", item.get("quantity"));
    orderItem.set("price", item.toJSON().product.price);
    await orderItem.save(null, { useMasterKey: true });
  }

  await Parse.Object.destroyAll(resultCartItem, { useMasterKey: true });

  return {
    id: savedOrder.id,
  };
});

Parse.Cloud.define("get-orders", async (req) => {
  const queryOrders = new Parse.Query("Order");
  queryOrders.equalTo("user", req.user);
  const resultOrders = await queryOrders.find({ useMasterKey: true });
  return resultOrders.map(function (o) {
    o = o.toJSON();
    return {
      id: o.objectId,
      total: o.total,
      createdAt: o.createdAt,
    };
  });
});

Parse.Cloud.define("get-order-items", async (req) => {
  if (req.user == null) throw "INVALID_USER";
  if (req.params.orderId == null) throw "INVALID_ORDER";
  const order = new Order();
  order.id = req.params.orderId;
  const queryOrderItems = new Parse.Query(OrderItem);
  queryOrderItems.equalTo("order", order);
  queryOrderItems.equalTo("user", req.user);
  queryOrderItems.include("product");
  queryOrderItems.include("product.category");
  const resultOrderItems = await queryOrderItems.find({ useMasterKey: true });
  return resultOrderItems.map(function (o) {
    o = o.toJSON();
    return {
      id: o.objectId,
      quantity: o.quantity,
      price: o.price,
      product: product.formatProductJson(o.product),
    };
  });
});
