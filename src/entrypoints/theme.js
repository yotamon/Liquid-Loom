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

if (!customElements.get("menu-disclosure")) customElements.define("menu-disclosure", MenuDisclosure);
if (!customElements.get("quantity-input")) customElements.define("quantity-input", QuantityInput);

document.documentElement.classList.remove("no-js");
document.documentElement.classList.add("js");
