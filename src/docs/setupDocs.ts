import readme from "../../README.md?raw";
import showdown from "showdown";
import "./docs.css";

const converter = new showdown.Converter(),
  html = converter.makeHtml(readme);

const element = document.getElementById("app");
if (element) element.innerHTML = html;
