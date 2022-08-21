const Product = Parse.Object.extend("Product");
const Category = Parse.Object.extend("Category");
const CartItem = Parse.Object.extend("CartItem");

Parse.Cloud.define("get-product-list", async (req) => {
  const queryProducts = new Parse.Query(Product);
  const page = req.params.page;
  const itemsPerPage = req.params.itemsPerPage || 20;

  if (itemsPerPage > 100) throw "Quantidade inválida de itens por página.";

  if (req.params.title != null) {
    queryProducts.fullText("title", req.params.title);
  }

  if (req.params.categoryId != null) {
    const category = new Category();
    category.id = req.params.categoryId;
    queryProducts.equalTo("category", category);
  }

  queryProducts.include("category");
  queryProducts.skip(itemsPerPage * page || 0);
  queryProducts.limit(itemsPerPage);

  const resultProducts = await queryProducts.find({ useMasterKey: true });
  return resultProducts.map(function (p) {
    p = p.toJSON();
    return formatProductJson(p);
  });
});

Parse.Cloud.define("get-category-list", async (req) => {
  const queryCategories = new Parse.Query(Category);
  const resultCategories = await queryCategories.find({ useMasterKey: true });
  return resultCategories.map(function (c) {
    c = c.toJSON();
    return {
      id: c.objectId,
      title: c.title,
    };
  });
});

Parse.Cloud.define("signup", async (req) => {
  if (req.params.fullname == null) throw "INVALID_FULLNAME";
  if (req.params.phone == null) throw "INVALID_PHONE";
  if (req.params.cpf == null) throw "INVALID_CPF";

  const user = new Parse.User();

  user.set("username", req.params.email);
  user.set("email", req.params.email);
  user.set("password", req.params.password);
  user.set("fullname", req.params.fullname);
  user.set("phone", req.params.phone);
  user.set("cpf", req.params.cpf);

  try {
    const resultUser = await user.signUp(null, { useMasterKey: true });
    return formatUser(resultUser);
  } catch (e) {
    throw "INVALID_DATA";
  }
});

Parse.Cloud.define("login", async (req) => {
  try {
    const user = await Parse.User.logIn(req.params.email, req.params.password);
    return formatUser(user);
  } catch (e) {
    throw "INVALID_CREDENTIALS";
  }
});

Parse.Cloud.define("validate-token", async (req) => {
  try {
    return formatUser(req.user);
  } catch (e) {
    throw "INVALID_TOKEN";
  }
});

Parse.Cloud.define("change-password", async (req) => {
  if (req.user == null) throw "INVALID_USER";

  const user = await Parse.User.logIn(
    req.params.email,
    req.params.currentPassword
  );

  if (user.id != req.user.id) throw "INVALID_USER";
  user.set("password", req.params.newPassword);
  await user.save(null, { useMasterKey: true });
});

Parse.Cloud.define("reset-password", async (req) => {
  await Parse.User.requestPasswordReset(req.params.email);
});

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
      product: formatProductJson(c.product),
    };
  });
});

//############################################################################# FUNCTIONS ###############################################################################
function formatUser(user) {
  const userJson = user.toJSON();
  return {
    id: userJson.objectId,
    fullname: userJson.fullname,
    email: userJson.email,
    phone: userJson.phone,
    cpf: userJson.cpf,
    token: userJson.sessionToken,
  };
}

function formatProductJson(product) {
  return {
    id: product.objectId,
    title: product.title,
    description: product.description,
    price: product.price,
    unit: product.unit,
    picture: product.picture.url,
    category: {
      title: product.category.title,
      id: product.category.objectId,
    },
  };
}
