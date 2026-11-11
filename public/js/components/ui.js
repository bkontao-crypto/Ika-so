import { h } from "/js/dom.js";

export const field = (label, input, attrs = {}) => h("label", { class: `field ${attrs.class ?? ""}` }, label, input);
export const select = (options, value, onChange, { blank } = {}) =>
  h("select", { class: "input", onChange: (e) => onChange(e.target.value) },
    blank ? h("option", { value: "" }, blank) : null,
    options.map((o) => h("option", { value: o, selected: o === value }, o)));
