export type Complete<T> = {
    [P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : T[P] | undefined;
};
export interface ICloneable {
    clone(): this;
}
export declare function cloneObject<T>(obj: T): T;
//# sourceMappingURL=utils.d.ts.map