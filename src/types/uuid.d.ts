/**
 * uuid 模块的本地类型声明（uuid@10 未内置类型，且 @types/uuid 未安装；
 * 不修改 package.json 依赖，仅声明本项目用到的 v4 导出）。
 */
declare module 'uuid' {
  export interface V4Options {
    random?: Uint8Array;
    rng?: () => Uint8Array;
  }
  export function v4(options?: V4Options, buffer?: Uint8Array, offset?: number): string;
  export function v4<TBuffer extends Uint8Array>(options: V4Options | null | undefined, buffer: TBuffer, offset?: number): TBuffer;
  export function v4<TBuffer extends Uint8Array>(options: V4Options | null | undefined, buffer?: TBuffer, offset?: number): string | TBuffer;
  export function validate(uuid: string): boolean;
  export function parse(uuid: string): Uint8Array;
  export function stringify(arr: Uint8Array, offset?: number): string;
}
