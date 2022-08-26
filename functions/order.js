var Gerencianet = require("gn-api-sdk-node");
const product = require("./product");
const Order = Parse.Object.extend("Order");
const OrderItem = Parse.Object.extend("OrderItem");

var options = {
  // PRODUÇÃO = false
  // HOMOLOGAÇÃO = true
  sandbox: true,
  client_id: process.env.CLIENT_ID_INTEGRACAO_PIX,
  client_secret: process.env.CLIENT_SECRET_INTEGRACAO_PIX,
  pix_cert: __dirname + process.env.PATH_CERTIFICADO_HOMOLOG,
};

var gerencianet = new Gerencianet(options);

Date.prototype.addSeconds = function (s) {
  this.setTime(this.getTime() + s * 1000);
  return this;
};

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

  const dueSeconds = 3600;
  const due = new Date().addSeconds(dueSeconds);

  const charge = await createCharge(
    dueSeconds,
    req.user.get("cpf"),
    req.user.get("fullname"),
    total
  );

  const qrCodeData = await generateQrCode(charge.loc.id);

  const order = new Order();
  order.set("total", total);
  order.set("user", req.user);
  order.set("dueDate", due);
  order.set("qrCodeImage", qrCodeData.imagemQrcode);
  order.set("qrCode", qrCodeData.qrcode);
  order.set("txid", charge.txid);
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
    total: total,
    qrCodeImage: qrCodeData.imagemQrcode,
    copiaecola: qrCodeData.qrcode,
    due: due.toISOString(),
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
      due: o.dueDate.iso,
      qrCodeImage: o.qrCodeImage,
      copiaecola: o.qrCode,
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

async function createCharge(dueSeconds, cpf, fullname, price) {
  let body = {
    calendario: {
      expiracao: dueSeconds,
    },
    devedor: {
      cpf: cpf.replace(/\D/g, ""),
      nome: fullname,
    },
    valor: {
      original: price.toFixed(2),
    },
    chave: "quitandavirtualgbl@gmail.com", // Informe sua chave Pix cadastrada na Gerencianet
    // infoAdicionais: [
    //   {
    //     nome: "Pagamento em",
    //     valor: "NOME DO SEU ESTABELECIMENTO",
    //   },
    //   {
    //     nome: "Pedido",
    //     valor: "NUMERO DO PEDIDO DO CLIENTE",
    //   },
    // ],
  };

  var response = await gerencianet.pixCreateImmediateCharge([], body);
  return response;
}

async function generateQrCode(locid) {
  let params = {
    id: locid,
  };

  const response = await gerencianet.pixGenerateQRCode(params);
  return response;
}
