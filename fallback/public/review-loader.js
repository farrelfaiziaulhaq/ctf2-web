(function () {
  const namedReviewConfig = document.forms.namedItem("reviewConfig");
  const config = window.reviewConfig || namedReviewConfig || {};
  let assetUrl = "/static/review-safe.js";
  if (config.assetUrl && typeof config.assetUrl.value === "string") {
    assetUrl = config.assetUrl.value;
  } else if (typeof config.assetUrl === "string") {
    assetUrl = config.assetUrl;
  }
  const script = document.createElement("script");
  script.src = assetUrl;
  document.body.appendChild(script);
})();
