import assert from "node:assert/strict";

const storeUrl = process.env.LIQUID_LOOM_STORE_URL;
const productPath = process.env.LIQUID_LOOM_PRODUCT_PATH;
const searchTerm = process.env.LIQUID_LOOM_SEARCH_TERM;
const password = process.env.LIQUID_LOOM_STOREFRONT_PASSWORD;
const optionValueId = process.env.LIQUID_LOOM_OPTION_VALUE_ID;
const expectedVariantId = process.env.LIQUID_LOOM_EXPECTED_VARIANT_ID;

if (!storeUrl || !productPath || !searchTerm || searchTerm.trim().length < 2) {
	throw new Error(
		"Shopify browser acceptance requires LIQUID_LOOM_STORE_URL, LIQUID_LOOM_PRODUCT_PATH, and a LIQUID_LOOM_SEARCH_TERM of at least two characters."
	);
}

const { chromium } = await import("playwright").catch(() => {
	throw new Error("Install Playwright in the test environment before running the optional Shopify browser smoke.");
});

const base = new URL(storeUrl);
if (!["http:", "https:"].includes(base.protocol)) throw new Error("Store preview must use HTTP or HTTPS.");
const productUrl = new URL(productPath, base);
if (productUrl.origin !== base.origin) throw new Error("The product fixture must belong to the provided storefront origin.");

async function navigate(page, url) {
	const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
	if (!response || !response.ok()) throw new Error("Shopify storefront navigation did not return a successful response.");
	const passwordInput = page.locator('form[action*="/password"] input[type="password"]');
	if (await passwordInput.count()) {
		if (!password) throw new Error("The storefront is password-protected. Provide the password through LIQUID_LOOM_STOREFRONT_PASSWORD.");
		await passwordInput.fill(password);
		await passwordInput.locator("xpath=ancestor::form").locator('button[type="submit"], input[type="submit"]').first().click();
		await page.waitForLoadState("domcontentloaded");
		await page.goto(url, { waitUntil: "domcontentloaded" });
	}
	await page.locator("main#MainContent").waitFor({ state: "visible", timeout: 15_000 });
}

function pass(name) {
	console.log("PASS " + name);
}

const browser = await chromium.launch({ headless: true });
try {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));

	await navigate(page, base.href);
	pass("Homepage renders a Shopify-native main landmark");

	await navigate(page, productUrl.href);
	const product = page.locator("[data-product-section]");
	await product.waitFor({ state: "visible" });
	const form = product.locator("product-form form").first();
	const variant = form.locator('input[name="id"]');
	const initialVariantId = await variant.inputValue();
	assert.ok(initialVariantId, "Product fixture must resolve a selected variant ID.");
	const productTitle = (await page.locator("h1").first().innerText()).trim();
	assert.ok(productTitle, "Product fixture must have a visible title.");
	pass("Product page renders an identified Shopify product variant");

	if (optionValueId) {
		const firstOption = form.locator("[data-product-option]").first();
		await firstOption.selectOption(optionValueId);
		await page.waitForFunction(
			(expectedId) => {
				const form = document.querySelector("[data-product-section] product-form form");
				const id = form?.querySelector('input[name="id"]')?.value;
				return Boolean(id && (!expectedId || id === expectedId) && document.querySelector("[data-product-section] product-form:not([aria-busy])"));
			},
			expectedVariantId,
			{ timeout: 12_000 }
		);
		assert.ok(await page.locator("[data-product-section] product-form input[name=id]").inputValue());
		pass("Product option refresh resolves the expected variant");
	} else {
		console.log("SKIP high-variant option selection: LIQUID_LOOM_OPTION_VALUE_ID not provided");
	}

	await navigate(page, new URL("search", base).href);
	const search = page.locator("predictive-search input[type=search]").first();
	await search.fill(searchTerm);
	await page.locator('#PredictiveSearchResults [role="option"]').first().waitFor({
		state: "visible",
		timeout: 12_000
	});
	await search.press("ArrowDown");
	assert.ok(await search.getAttribute("aria-activedescendant"));
	await search.press("Escape");
	assert.equal(await search.getAttribute("aria-expanded"), "false");
	pass("Predictive search supports ArrowDown and Escape keyboard interaction");

	await navigate(page, productUrl.href);
	const purchase = page.locator("product-form button[type=submit]").first();
	assert.equal(await purchase.isDisabled(), false, "The product fixture must be purchasable.");
	await purchase.click();
	await page.waitForTimeout(900);
	await navigate(page, new URL("cart", base).href);
	const cartLines = page.locator(".cart-table tbody tr");
	assert.ok((await cartLines.count()) > 0, "Cart must contain the product after purchase-form submission.");
	assert.ok((await page.locator(".cart-product a").allTextContents()).some((title) => title.includes(productTitle)));
	pass("Add-to-cart persists a line item through the native cart page");

	const withoutJavaScript = await browser.newContext({ javaScriptEnabled: false });
	const noJsPage = await withoutJavaScript.newPage();
	await navigate(noJsPage, productUrl.href);
	const inactiveOptions = noJsPage.locator("product-form [data-product-option]");
	if ((await inactiveOptions.count()) > 0) {
		assert.equal(await inactiveOptions.first().isVisible(), false, "No-JavaScript variant choices must not imply working selection.");
		const variantDescription = noJsPage.locator("product-form .product-form__option-fallback");
		assert.equal(await variantDescription.isVisible(), true, "No-JavaScript mode must identify the actual selected variant.");
		assert.ok((await variantDescription.innerText()).trim().length > 0);
	}
	assert.ok(await noJsPage.locator("product-form input[name=id]").inputValue());
	pass("No-JavaScript purchase form identifies its actual selected variant");
	await withoutJavaScript.close();

	assert.deepEqual(errors, [], "Uncaught storefront errors occurred during the acceptance flow.");
	pass("No uncaught page errors");
	console.log("PASS All required browser checks completed (no checkout/order submitted).");
	await context.close();
} finally {
	await browser.close();
}
