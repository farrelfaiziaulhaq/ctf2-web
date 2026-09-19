const path = require("node:path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: "production",
  target: "web",
  entry: path.resolve(__dirname, "frontend/review-entry.js"),
  output: {
    path: path.resolve(__dirname, "public"),
    filename: "review.bundle.js",
    chunkFilename: "chunks/preview-runtime.js",
    publicPath: "auto",
    clean: false
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        parallel: false
      })
    ]
  }
};
