export {};
declare global {
   interface Console {
     log(...data: unknown[]): void;
   }
   var console: Console;
}
