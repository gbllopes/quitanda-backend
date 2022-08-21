const Product = Parse.Object.extend("Product");
const Category = Parse.Object.extend("Category");

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

//############################################################################# FUNCTIONS ###############################################################################
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

module.exports = { formatProductJson };
