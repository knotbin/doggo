/**
 * A well documented function
 * @param x - The input number
 * @returns The doubled value
 */
export function documentedFunction(x: number): number {
  return x * 2;
}

/**
 * A documented class with proper JSDoc
 */
export class DocumentedClass {
  constructor(public name: string) {}
  
  greet(): string {
    return `Hello, ${this.name}`;
  }
}

/**
 * A documented interface
 */
export interface DocumentedInterface {
  id: string;
  value: number;
}

/**
 * A documented constant
 */
export const documentedConst = 42;
