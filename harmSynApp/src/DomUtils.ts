// Browser DOM utilities.

import * as DialogManager from "dialog-manager";
import {catchError} from "./Utils.ts";

const numberFormat = new Intl.NumberFormat("en-US");

export function elementExists (elementId: string) : boolean {
   return !!document.getElementById(elementId); }

export function getElement (elementOrId: HTMLElement | string) : HTMLElement {
   if (typeof elementOrId != "string") {
      return elementOrId; }
   const e = <HTMLElement>document.getElementById(elementOrId);
   if (!e) {
      throw new Error("No HTML element found with ID \"" + elementOrId + "\"."); }
   return e; }

export function getInputElement (elementOrId: HTMLInputElement | string) : HTMLInputElement {
   return <HTMLInputElement>getElement(elementOrId); }
export function getSelectElement (elementOrId: HTMLInputElement | string) : HTMLSelectElement {
   return <HTMLSelectElement>getElement(elementOrId); }

// Shows or hides a DOM element.
// If the element is an input element with an associated label element, the label element is also affected.
export function showElement (elementOrId: HTMLElement | string, visible = true) {
   const e = getElement(elementOrId);
   e.classList.toggle("hidden", !visible);
   const labels = (<HTMLInputElement>e).labels;
   if (labels) {
      for (const labelElement of labels) {
         labelElement.classList.toggle("hidden", !visible); }}}

export function isElementVisible (elementOrId: HTMLElement | string) : boolean {
   const e = getElement(elementOrId);
   return !e.classList.contains("hidden"); }

export function enableElement (elementOrId: HTMLInputElement | string, enabled = true) {
   getInputElement(elementOrId).disabled = !enabled; }

function getInputElementLabelText (e: HTMLInputElement) : string {
   let s = (e.labels && e.labels.length > 0) ? e.labels[0].textContent ?? "" : "";
   if (s.length > 0 && s[s.length - 1] == ":") {
      s = s.substring(0, s.length - 1); }
   return s; }

function genValidityErrorMsg (elementOrId: HTMLInputElement | string) {
   const e = getInputElement(elementOrId);
   const labelText = getInputElementLabelText(e);
   const info = labelText ? ` with label "${labelText}"` : e.id ? ` with ID "${e.id}"` : "";
   return "Invalid value in input field" + info + "."; }

function checkValidity (e: HTMLInputElement) {
   if (!e.checkValidity()) {
      throw new Error(genValidityErrorMsg(e)); }}

export function getValue (elementOrId: HTMLInputElement | string) : string {
   const e = getInputElement(elementOrId);
   checkValidity(e);
   return e.value; }

export function setValue (elementOrId: HTMLInputElement | string, newValue: string) {
   getInputElement(elementOrId).value = newValue; }

export function setText (elementOrId: HTMLElement | string, text: string) {
   getElement(elementOrId).textContent = text; }

export function setTitle (elementOrId: HTMLElement | string, title: string) {
   getElement(elementOrId).title = title; }

export function setFocus (elementOrId: HTMLElement | string) {
   getElement(elementOrId).focus(); }

export function getValueNumOpt (elementOrId: HTMLInputElement | string) : number | undefined {
   const e = getInputElement(elementOrId);
   checkValidity(e);
   if (e.value == "") {
      return undefined; }
   if (e.type == "number") {
      return e.valueAsNumber; }
   const v = decodeNumber(e.value);
   if (v == undefined) {
      throw new Error(genValidityErrorMsg(e)); }
   return v; }

export function getValueNum (elementOrId: HTMLInputElement | string) : number {
   const v = getValueNumOpt(elementOrId);
   if (v == undefined) {
      throw new Error(genValidityErrorMsg(elementOrId)); }
   return v; }

export function setValueNum (elementOrId: HTMLInputElement | string, n: number | undefined) {
   const e = getInputElement(elementOrId);
   if (n == undefined || isNaN(n)) {
      e.value = "";
      return; }
   if (e.type == "number") {
      e.valueAsNumber = n;
      return; }
   e.value = formatNumber(n); }

export function addNumericFieldFormatSwitcher (elementOrId: HTMLInputElement | string) {
   const e = getInputElement(elementOrId);
   e.addEventListener("focusin", () => {
      const n = decodeNumber(e.value);
      if (n != undefined) {
         e.value = String(n); }});
   e.addEventListener("focusout", () => {
      const n = decodeNumber(e.value);
      if (n != undefined) {
         e.value = formatNumber(n); }}); }

export function getChecked (elementOrId: HTMLInputElement | string) : boolean {
   return getInputElement(elementOrId).checked; }

export function setChecked (elementOrId: HTMLInputElement | string, newValue: boolean) {
   getInputElement(elementOrId).checked = newValue; }

export function setClass (elementOrId: HTMLInputElement | string, className: string, enable = true) {
   const e = getElement(elementOrId);
   e.classList.toggle(className, enable); }

export function addEventListener (elementOrId: HTMLElement | string, eventType: string, listener: Function, ...args: any[]) {
   const e = getElement(elementOrId);
   e.addEventListener(eventType, (event: Event) => void catchError(listener, event, ...args)); }

export function addChangeEventListener (elementOrId: HTMLElement | string, listener: Function, ...args: any[]) {
   addEventListener(elementOrId, "change", listener, ...args); }

export function addClickEventListener (elementOrId: HTMLElement | string, listener: Function, ...args: any[]) {
   addEventListener(elementOrId, "click", listener, ...args); }

export function formatNumber (n: number | undefined, includeSign: boolean = false) : string {
   if (n === undefined || !isFinite(n)) {
      return ""; }
   const plusSign = (includeSign && n > 0) ? "+" : "";
   return plusSign + numberFormat.format(n).replace(/,/g, "\u202F"); }

// Returns undefined if the string does not contain a valid number.
export function decodeNumber (s: string) : number | undefined {
   if (!s) {
      return undefined; }
   const n = Number(s.replace(/[\u{2000}-\u{20FF}]/gu, ""));
   return isFinite(n) ? n : undefined; }

export async function promptNumber (titleText: string, promptText: string, defaultValue: number) : Promise<number|undefined> {
   const s = await DialogManager.promptInput({titleText, promptText, defaultValue: String(defaultValue)});
   if (!s) {
      return; }
   const n = Number(s);
   if (!Number.isFinite(n)) {
      await DialogManager.showMsg({titleText: "Error", msgText: "Invalid number: " + s});
      return; }
   return n; }

//--- Field info ---------------------------------------------------------------

let visibleInfoTextElement: HTMLDivElement | undefined = undefined;

function prepareFieldInfo2 (fieldElement: HTMLElement) {
   const infoButtonElement = document.createElement("div");
   infoButtonElement.className = "fieldInfoButton";
   fieldElement.appendChild(infoButtonElement);
   const infoTextElement = document.createElement("div");
   const infoText = fieldElement.dataset.info!;
   infoTextElement.innerHTML = infoText;
   infoTextElement.className = "fieldInfoText hidden";
   fieldElement.appendChild(infoTextElement);
   infoButtonElement.addEventListener("click", (_event: Event) => {
      if (visibleInfoTextElement && visibleInfoTextElement != infoTextElement) {
         visibleInfoTextElement.classList.add("hidden"); }
      const hidden = infoTextElement.classList.toggle("hidden");
      visibleInfoTextElement = hidden ? undefined : infoTextElement; }); }

export function prepareFieldInfo() {
   for (const fieldElement of <NodeListOf<HTMLElement>>document.querySelectorAll("div[data-info]")) {
      prepareFieldInfo2(fieldElement); }
   document.addEventListener("click", (event: Event) => {
      if (!visibleInfoTextElement || !(event.target instanceof Node)) {
         return; }
      const fieldElement = <HTMLElement>visibleInfoTextElement.parentNode;
      if (fieldElement?.contains(event.target)) {
         return; }
      // Handle a click somewhere outside of the current field and it's sub-elements.
      visibleInfoTextElement.classList.add("hidden");
      visibleInfoTextElement = undefined; }); }
