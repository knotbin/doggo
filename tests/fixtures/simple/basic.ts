export function documentedFunction(x: number): number {
  return x * 2;
}

export class UndocumentedClass {
  constructor(public name: string) {}
  
  greet(): string {
    return `Hello, ${this.name}`;
  }
}

export interface DocumentedInterface {
  id: string;
  value: number;
}

export const undocumentedConst = 42;
