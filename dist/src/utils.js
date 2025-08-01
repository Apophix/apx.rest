export function cloneObject(obj) {
    return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
}
