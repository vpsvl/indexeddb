/**
 * 判断类型
 * @param val
 * @returns {string}
 */
export function typeOf(val) {
  return Object.prototype.toString.call(val).replace(/.* (.*)]/, '$1');
}

/**
 * 非字符串键转成字符串
 * @param key
 * @returns {string}
 */
export function keyToString(key) {
  return typeof key === 'string' ? key : JSON.stringify(key);
}

// 游标方向
export const directions = {next: true, nextunique: true, prev: true, prevunique: true};

/**
 * 返回游标范围
 * @param start  可选. 索引的起始值, 查询表中所有数据start和end都不传即可; 只查询大于start的数据, end不传即可
 * @param end  可选. 索引结束值, 只查单个索引, 传入跟start相同的值即可; 查询所有小于end的数据, start不传即可
 * @returns {*}
 */
export function getRange(start, end) {
  const startType = typeOf(start);
  const endType = typeOf(end);
  if (startType === 'Undefined' && endType === 'Undefined') {
    return undefined;
  }
  if (startType !== 'Undefined' && endType === 'Undefined') {
    return IDBKeyRange.upperBound(start);
  }
  if (startType === 'Undefined' && endType !== 'Undefined') {
    return IDBKeyRange.lowerBound(end);
  }
  return end === start ? IDBKeyRange.only(start) : IDBKeyRange.bound(start, end);
}

/**
 * 添加/修改数据, 成功会resolve添加/修改的key
 * @param objectStore
 * @param val
 * @param key
 * @param opr
 * @returns {Promise}
 */
export function setItem(objectStore, val, key, opr = 'put') {
  return new Promise((resolve) => {
    let _key;
    if (objectStore.keyPath === null) {
      _key = typeOf(val) === 'Object' && Reflect.has(val, key) ? val[key] : key;
    } else if (typeOf(val) !== 'Object' || !Reflect.has(val, objectStore.keyPath)) {
      console.warn(`The object store uses in-line keys and the key '${key}' was provided`);
      return resolve(false);
    }
    const request = _key ? objectStore[opr](val, _key) : objectStore[opr](val);
    request.onsuccess = (e) => {
      resolve(true);
    };
    request.onerror = (e) => {
      // console.warn(e.target.error);
      resolve(false);
    };
  });
}