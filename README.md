# indexeddb

IndexedDB的所有操作都是异步的，API都是在回调函数中执行的，为了便于对其进行操作，使用ES6中的`Promise`来封装。

## 1. 安装

#### npm包

```
// use npm
npm install --save-dev @vpsvl/indexeddb
// use yarn
yarn add --dev @vpsvl/indexeddb
// use pnpm
pnpm add -D @vpsvl/indexeddb
```

#### script引入

`createIndexedDB` 会被注册为一个全局变量

```
<script src="https://unpkg.com/@vpsvl/indexeddb@1.0.0"></script>
```

## 2. 使用

```
import createIndexedDB from '@vpsvl/indexeddb'

export const db = createIndexedDB('databaseName')
```

## 3. API

#### db.delDB()

删除数据库

#### db.hasStore({store})

判断数据库中是否存在objectStore

* store 可选. 不传会将undefined转为字符串'undefined'

#### db.addStore({store, index, key, replace = false})

创建objectStore, 建议使用索引

* store 可选. 要创建的objectStore的名字, 不传会将undefined转为字符串'undefined'
* index 可选. 需要创建objectStore索引时传入,key为字段名,value为boolean表示是否允许重复
* key 可选. 主键名, 对应每条数据必须为包含keyPath属性的对象; 不传则使用主键自增(默认从1开始, 如果之前有number类型的主键, 会对最大一个number类型主键取整数, 然后加1作为自增后的主键)
* replace 可选. 如果表存在是否先删除再创建, 默认不删除不创建

#### db.delStore({store})

删除objectStore

* store 可选. 删除的objectStore名, 不传会将undefined转为字符串'undefined'

#### db.get({store, key})

根据主键值key来获取数据, resolve查到的数据

* store 可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
* key 必选. 主键

#### db.find({store, index, start, end, direction, filter})

通过游标来获取指定索引跟范围的值, 成功会resolve查到的数据(Array)

* store 可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
* index 可选. 索引名, 如果不传索引, start和end为主键范围
* start 可选. 索引的起始值, 查询表中所有数据start和end都不传即可; 只查询大于start的数据, end不传即可
* end 可选. 索引结束值, 只查单个索引, 传入跟start相同的值即可; 查询所有小于end的数据, start不传即可
* direction 可选. 默认next. 光标的遍历方向, 值为以下4个: 'next'(下一个),'nextunique'(下一个不包括重复值),'prev'(上一个),'prevunique'(上一个不包括重复值)
* filter 可选. 过滤数据方法

#### db.findPage({store, index, start, end, page, pageSize, direction, filter})

通过游标来获取指定索引跟范围的值, 成功会resolve({total: Number //总条数, list: Array //列表数据})

* store 可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
* index 可选. 索引名, 如果不传索引, start和end为主键范围
* start 可选. 索引的起始值, 查询表中所有数据start和end都不传即可; 只查询大于start的数据, end不传即可
* end 可选. 索引结束值, 只查单个索引,传入跟start相同的值即可;查询所有小于end的数据, start不传即可
* page 可选. 默认1. 页码, Number
* pageSize 可选. 默认10. 每页有多少条数据, Number
* direction 可选. 光标的遍历方向, 值为以下4个: 'next'(下一个),'nextunique'(下一个不包括重复值),'prev'(上一个),'prevunique'(上一个不包括重复值)
* filter 可选. 过滤数据方法

#### db.count({store, index, start, end})

查询objectStore中的数据总条数

* store 可选. 需要查询数据的objectStore名, 不传会将undefined转为字符串'undefined'
* index 可选. 索引名, 如果不传索引, start和end为主键范围
* start 可选. 索引的起始值, 查询表中所有数据start和end都不传即可; 只查询大于start的数据, end不传即可
* end 可选. 索引结束值, 只查单个索引, 传入跟start相同的值即可; 查询所有小于end的数据, start不传即可

#### db.set({store, val, key, spread = true, onlyAdd = false})

添加/修改数据, 成功会resolve([true/false, true/false, ...])

* store 可选. 需要添加/修改数据的objectStore名, 不传会将undefined转为字符串'undefined'
* val 必选. 添加/修改的数据, 如果为数组且遍历该数组, 每个元素作为一条数据进行添加/修改. 如果添加objectStore有指定主键, 那么val必须为包含主键属性的对象或数组中每个元素都为为包含主键属性的对象
* key 可选. 如果有指定keyPath, 该值会被忽略. 如果val为对象或数组中元素为对象, 可以是其中的属性名
* spread 可选. 数组是否遍历后存储, 如果有指定keyPath一定会遍历数组
* onlyAdd 可选. 是否只添加不修改

#### db.del({store, index, start, end, filter})

删除objectStore中的数据, 成功会resolve('done')

* store 可选. 需要删除数据的objectStore名, 不传会将undefined转为字符串'undefined'
* index 可选. 索引名, 如果不传索引, start和end为主键范围
* start 可选. 主键的起始值, 删除表中所有数据start和end都不传即可(等同于clear方法); 只查询大于start的数据, end不传即可
* end 可选. 主键的结束值, 只删单个数据, 传入跟start相同的值即可; 删除所有小于end的数据, start不传即可
* filter 可选. 过滤数据方法

#### db.clear({store})

清空objectStore中的数据, 成功会resolve('done')

* store 可选, 不传会将undefined转为字符串'undefined'
