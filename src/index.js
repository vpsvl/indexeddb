import {typeOf, keyToString, getRange, setItem, directions} from './utils';

/**
 * indexedDB的增删改查:
 * 1. 所有的数据库操作都是异步的!!!必须处理好异步,否则会造成某一操作的数据库版本过时!!!
 * 2. 建议耗时的操作在webWorker中进行
 * @param name
 * @returns {object}
 */
export default function createIndexedDB(name = 'indexedDB') {
  if (typeof name !== 'string') {
    name = JSON.stringify(name);
  } else if (name === '') {
    name = 'indexedDB';
  }
  // 数据库名
  const database = name;
  // 数据库实例
  let db = null;
  // 版本号
  let version = Date.now();

  /**
   * 删除数据库
   * @returns {Promise}
   */
  function delDB() {
    close();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(database);
      request.onsuccess = (e) => {
        resolve(e.target.readyState);
      };
      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }

  /**
   * 打开数据库
   * @returns {Promise}
   * @private
   */
  function open() {
    if (!db) {
      version = Date.now();
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(database, version);
      request.onerror = (e) => {
        db = null;
        reject(e.target.error);
      };
      request.onsuccess = (e) => {
        db = request.result;
        db.onversionchange = (e) => close();
        resolve(db);
      };
      request.onblocked = (e) => close();
    });
  }

  /**
   * 关闭数据库
   */
  function close() {
    if (db) {
      db.close();
      db = null;
    }
  }

  /**
   * 判断数据库中是否存在objectStore
   * @param store 可选. 不传会将undefined转为字符串'undefined'
   * @returns {Promise}
   */
  async function hasStore({store} = {}) {
    try {
      if (!db) {
        await open();
      }
      return db.objectStoreNames.contains(store);
    } catch (e) {
      throw e;
    }
  }

  /**
   * 创建objectStore, 建议使用索引
   * @param store  可选. 要创建的objectStore的名字, 不传会将undefined转为字符串'undefined'
   * @param index  可选. 需要创建objectStore索引时传入,key为字段名,value为boolean表示是否允许重复
   * @param key   可选. 主键名, 对应每条数据必须为包含keyPath属性的对象; 不传则使用主键自增(默认从1开始, 如果之前有number类型的主键, 会对最大一个number类型主键取整数, 然后加1作为自增后的主键)
   * @param replace  可选. 如果表存在是否先删除再创建, 默认不删除不创建
   * @returns {Promise}
   */
  function addStore({store, index, key, replace = false} = {}) {
    return new Promise((resolve, reject) => {
      close();
      version = Date.now();
      store = keyToString(store);
      const request = indexedDB.open(database, version);
      request.onupgradeneeded = (e) => {
        let db = e.target.result;
        if (db.objectStoreNames.contains(store)) {
          if (!replace) {
            return resolve(e.target.readyState);
          }
          db.deleteObjectStore(store);
        }
        let objectStore = db.createObjectStore(store, key ? {keyPath: key} : {autoIncrement: true});
        if (typeOf(index) === 'Object') {
          for (let key in index) {
            if (index.hasOwnProperty(key)) {
              objectStore.createIndex(key, key, {unique: !!index[key]});
            }
          }
        }
        resolve(e.target.readyState);
      };
      request.onsuccess = (e) => {
        db = request.result;
        db.onversionchange = (e) => close();
      };
      request.onerror = (e) => {
        db = null;
        reject(e.target.error);
      };
    });
  }

  /**
   * 删除objectStore
   * @param store 可选. 删除的objectStore名, 不传会将undefined转为字符串'undefined'
   * @returns {Promise}
   */
  function delStore({store} = {}) {
    return new Promise((resolve, reject) => {
      close();
      version = Date.now();
      store = keyToString(store);
      const request = indexedDB.open(database, version);
      request.onupgradeneeded = (e) => {
        let db = e.target.result;
        if (db.objectStoreNames.contains(store)) {
          db.deleteObjectStore(store);
        }
        resolve(e.target.readyState);
      };
      request.onsuccess = (e) => {
        db = request.result;
        db.onversionchange = (e) => close();
      };
      request.onerror = (e) => {
        db = null;
        reject(e.target.error);
      };
    });
  }

  /**
   * 根据主键值key来获取数据, resolve查到的数据
   * @param store 可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
   * @param key 必选. 主键
   * @returns {Promise}
   */
  function get({store, key} = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!db) {
          await open();
        }
        store = keyToString(store);
        const transaction = db.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.get(key);
        request.onsuccess = (e) => {
          let result = e.target.result;
          resolve(result);
        };
        request.onerror = (e) => {
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 通过游标来获取指定索引跟范围的值,成功会resolve查到的数据(Array)
   * 对有建立索引的objectStore, 建议使用游标来查询
   * @param store   可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
   * @param index  必选. 索引名
   * @param start  可选. 索引的起始值, 查询表中所有数据start和end都不传即可; 只查询大于start的数据, end不传即可
   * @param end  可选. 索引结束值, 只查单个索引, 传入跟start相同的值即可; 查询所有小于end的数据, start不传即可
   * @param direction 可选. 默认next. 光标的遍历方向, 值为以下4个: 'next'(下一个),'nextunique'(下一个不包括重复值),'prev'(上一个),'prevunique'(上一个不包括重复值)
   * @param filter 可选. 过滤数据方法
   * @returns {Promise}
   */
  function find({store, index, start, end, direction, filter} = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!db) {
          await open();
        }
        store = keyToString(store);
        const transaction = db.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const indexObj = objectStore.index(index);
        let range = getRange(start, end);
        if (!directions[direction]) {
          direction = 'next';
        }
        const isFilter = typeOf(filter) === 'Function';
        const request = indexObj.openCursor(range, direction);
        let result = [];
        request.onsuccess = (e) => {
          let cursor = e.target.result;
          if (!cursor) {
            return resolve(result);
          }
          if (isFilter) {
            if (filter(cursor.value)) {
              result.push(cursor.value);
            }
          } else {
            result.push(cursor.value);
          }
          cursor.continue();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 通过游标来获取指定索引跟范围的值,成功会resolve({total: Number //总条数, list: Array //列表数据})
   * @param store   可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
   * @param index  必选. 索引名
   * @param start  可选. 索引的起始值, 查询表中所有数据start和end都不传即可; 只查询大于start的数据, end不传即可
   * @param end  可选. 索引结束值, 只查单个索引, 传入跟start相同的值即可; 查询所有小于end的数据, start不传即可
   * @param page 可选. 默认1. 页码, Number
   * @param pageSize 可选. 默认10. 每页有多少条数据, Number
   * @param direction 可选. 光标的遍历方向, 值为以下4个: 'next'(下一个),'nextunique'(下一个不包括重复值),'prev'(上一个),'prevunique'(上一个不包括重复值)
   * @param filter 可选. 过滤数据方法
   * @returns {Promise}
   */
  function findPage({store, index, start, end, direction, page = 1, pageSize = 10, filter} = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        page = parseInt(page);
        let size = parseInt(pageSize);
        if (isNaN(page) || isNaN(size) || page < 1 || size < 1) {
          reject('The page and pageSize parameters must be number and greater than 0');
        }
        if (!db) {
          await open();
        }
        store = keyToString(store);
        const transaction = db.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const indexObj = objectStore.index(index);
        let range = getRange(start, end);
        if (!directions[direction]) {
          direction = 'next';
        }
        let total = 0;
        let cursorNum = 0;
        let list = [];
        const isFilter = typeOf(filter) === 'Function';
        if (!isFilter) {
          const requestCount = indexObj.count();
          requestCount.onerror = (e) => {
            reject(e.target.error);
          };
          requestCount.onsuccess = (e) => {
            total = e.target.result;
            if (total <= size * (page - 1)) {
              resolve({
                total,
                list: [],
              });
            }
          };
        }
        const request = indexObj.openCursor(range, direction);
        request.onsuccess = (e) => {
          let cursor = e.target.result;
          if (isFilter) {
            if (!cursor) {
              return resolve({
                total: cursorNum,
                list,
              });
            }
            if (filter(cursor.value)) {
              cursorNum++;
              if (cursorNum > size * (page - 1) && cursorNum <= page * size) {
                list.push(cursor.value);
              }
            }
            cursor.continue();
          } else {
            if (!cursor || cursorNum >= page * size) {
              return resolve({
                total,
                list,
              });
            }
            cursorNum++;
            if (cursorNum > size * (page - 1)) {
              list.push(cursor.value);
            }
            cursor.continue();
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 查询objectStore中的数据总条数
   * @param index 可选. 索引名, 如果不传索引, start和end为主键范围
   * @param store  可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
   * @param start  可选. 索引的起始值, 查询表中所有数据start和end都不传即可; 只查询大于start的数据, end不传即可
   * @param end  可选. 索引结束值, 只查单个索引, 传入跟start相同的值即可; 查询所有小于end的数据, start不传即可
   * @returns {Promise}
   */
  function count({store, index, start, end} = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!db) {
          await open();
        }
        store = keyToString(store);
        const transaction = db.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const indexObj = index ? objectStore.index(index) : objectStore;
        const request = indexObj.count(getRange(start, end));
        request.onerror = (e) => {
          reject(e.target.error);
        };
        request.onsuccess = (e) => {
          resolve(e.target.result);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 添加/修改数据, 成功会resolve([true/false, true/false, ...])
   * @param store  可选. 需要添加/修改数据的objectStore名, 不传会将undefined转为字符串'undefined'
   * @param val  必选. 添加/修改的数据, 如果为数组且遍历该数组, 每个元素作为一条数据进行添加/修改. 如果添加objectStore有指定主键, 那么val必须为包含主键属性的对象或数组中每个元素都为为包含主键属性的对象
   * @param key  可选. 如果有指定keyPath, 该值会被忽略. 如果val为对象或数组中元素为对象, 可以是其中的属性名
   * @param spread 可选. 数组是否遍历后存储, 如果有指定keyPath一定会遍历数组
   * @param onlyAdd 可选. 是否只添加不修改, 因为add方法完成时会关闭事务, 所以只支持添加单条数据
   * @returns {Promise}
   */
  function set({store, val, key, spread = true, onlyAdd = false} = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!db) {
          await open();
        }
        store = keyToString(store);
        const transaction = db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const result = [];
        if (typeOf(val) === 'Array' && (spread || objectStore.keyPath !== null)) {
          for (let item of val) {
            result.push(await setItem(objectStore, item, key, 'put'));
          }
        } else {
          const opr = onlyAdd ? 'add' : 'put';
          result.push(await setItem(objectStore, val, key, opr));
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 删除objectStore中的数据, 成功会resolve('done')
   * @param store  可选. 需要删除数据的objectStore名, 不传会将undefined转为字符串'undefined'
   * @param index 可选. 索引名, 如果不传索引, start和end为主键范围
   * @param start  可选. 主键的起始值, 删除表中所有数据start和end都不传即可(等同于clear方法); 只查询大于start的数据, end不传即可
   * @param end  可选. 主键的结束值, 只删单个数据, 传入跟start相同的值即可; 删除所有小于end的数据, start不传即可
   * @param filter 可选. 过滤数据方法
   * @returns {Promise}
   */
  function del({store, index, start, end, filter} = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!db) {
          await open();
        }
        store = keyToString(store);
        const transaction = db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const range = getRange(start, end);
        const isFilter = typeOf(filter) === 'Function';
        // 使用索引
        if (index) {
          const indexObj = objectStore.index(index);
          const request = indexObj.openCursor(range);
          request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) {
              resolve(e.target.readyState);
            }
            if (isFilter) {
              if (filter(cursor.value)) {
                cursor.delete();
              }
            } else {
              cursor.delete();
            }
          };
          return;
        }
        // 不使用索引
        if (isFilter) {
          // 需要过滤的情况使用游标
          const request = objectStore.openCursor(range);
          request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor) {
              resolve(e.target.readyState);
            }
            if (filter(cursor.value)) {
              cursor.delete();
            }
          };
        } else {
          const request = range ? objectStore.delete(range) : objectStore.clear();
          request.onsuccess = (e) => {
            resolve(e.target.readyState);
          };
          request.onerror = (e) => {
            reject(e.target.error);
          };
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 清空objectStore中的数据, 成功会resolve('done')
   * @param store 可选, 不传会将undefined转为字符串'undefined'
   * @returns {Promise}
   */
  function clear({store} = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!db) {
          await open();
        }
        store = keyToString(store);
        const transaction = db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.clear();
        request.onsuccess = (e) => {
          resolve(e.target.readyState);
        };
        request.onerror = (e) => {
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  return {
    delDB,
    hasStore,
    addStore,
    delStore,
    close,
    open,
    set,
    get,
    find,
    findPage,
    count,
    del,
    clear,
  };
}
