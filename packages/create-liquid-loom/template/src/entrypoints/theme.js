import "../styles/theme.css";

class MenuDisclosure extends HTMLElement {
	connectedCallback() {
		this.button = this.querySelector("button");
		this.panel = this.querySelector("[data-menu-panel]");
		if (!this.button || !this.panel) return;

		this.button.addEventListener("click", () => this.toggle());
		this.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && this.isOpen()) {
				this.close();
				this.button.focus();
			}
		});
	}

	isOpen() {
		return this.button.getAttribute("aria-expanded") === "true";
	}

	toggle() {
		this.isOpen() ? this.close() : this.open();
	}

	open() {
		this.button.setAttribute("aria-expanded", "true");
		this.panel.removeAttribute("hidden");
		document.documentElement.classList.add("menu-open");
	}

	close() {
		this.button.setAttribute("aria-expanded", "false");
		this.panel.setAttribute("hidden", "");
		document.documentElement.classList.remove("menu-open");
	}
}

class QuantityInput extends HTMLElement {
	connectedCallback() {
		this.input = this.querySelector("input[type='number']");
		this.querySelectorAll("button").forEach((button) => {
			button.addEventListener("click", () => this.change(button.dataset.quantityAction));
		});
	}

	change(action) {
		if (!this.input) return;
		const step = Number(this.input.step) || 1;
		const minimum = Number(this.input.min) || 1;
		const current = Number(this.input.value) || minimum;
		this.input.value = String(Math.max(minimum, current + (action === "increase" ? step : -step)));
		this.input.dispatchEvent(new Event("change", { bubbles: true }));
	}
}

class PredictiveSearch extends HTMLElement {
	connectedCallback() {
		this.input = this.querySelector("input[type='search']");
		this.results = this.querySelector("[data-predictive-search-results]");
		if (!this.input || !this.results) return;
		this.input.addEventListener("input", () => {
			clearTimeout(this.timer);
			this.timer = setTimeout(() => this.search(), 180);
		});
	}

	async search() {
		const query = this.input.value.trim();
		this.controller?.abort();
		if (query.length < 2) {
			this.results.replaceChildren();
			this.input.setAttribute("aria-expanded", "false");
			return;
		}

		this.controller = new AbortController();
		try {
			const url = `/search/suggest?q=${encodeURIComponent(query)}&resources[type]=product&section_id=predictive-search`;
			const response = await fetch(url, { signal: this.controller.signal });
			if (!response.ok) throw new Error(`Search request failed: ${response.status}`);
			const document = new DOMParser().parseFromString(await response.text(), "text/html");
			const content = document.querySelector(".predictive-search__results");
			this.results.replaceChildren(...(content ? [content] : []));
			this.input.setAttribute("aria-expanded", content ? "true" : "false");
		} catch (error) {
			if (error.name !== "AbortError") console.error(error);
		}
	}
}

class ProductForm extends HTMLElement {
	connectedCallback() {
		this.select = this.querySelector("[data-variant-select]");
		this.submit = this.querySelector("button[type='submit']");
		const data = this.querySelector("[data-product-variants]");
		if (!this.select || !data) return;
		this.variants = JSON.parse(data.textContent);
		this.select.addEventListener("change", () => this.variantChanged());
	}

	variantChanged() {
		const variant = this.variants.find(({ id }) => String(id) === this.select.value);
		if (!variant) return;
		this.submit?.toggleAttribute("disabled", !variant.available);
		const url = new URL(window.location.href);
		url.searchParams.set("variant", variant.id);
		window.history.replaceState({}, "", url);
	}
}

if (!customElements.get("menu-disclosure")) customElements.define("menu-disclosure", MenuDisclosure);
if (!customElements.get("quantity-input")) customElements.define("quantity-input", QuantityInput);
if (!customElements.get("predictive-search")) customElements.define("predictive-search", PredictiveSearch);
if (!customElements.get("product-form")) customElements.define("product-form", ProductForm);

document.documentElement.classList.remove("no-js");
document.documentElement.classList.add("js");
