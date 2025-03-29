export type Complete<T> = {
	[P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : T[P] | undefined;
};


export interface ICloneable { 
	clone(): this; 
}

export function cloneObject<T>(obj: T): T {
	return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj)
}