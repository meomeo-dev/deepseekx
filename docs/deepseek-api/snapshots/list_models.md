---
title: "列出模型"
source_url: "https://api-docs.deepseek.com/zh-cn/api/list-models"
retrieved_at: "2026-05-12"
---
# 列出模型

```
GET /models
```

列出可用的模型列表，并提供相关模型的基本信息。请前往模型  &
价格查看当前支持的模型列表

## Responses​

- 200

OK, 返回模型列表

- application/json

- Schema

- Example (from schema)

- Example

**

Schema

**

**object** stringrequired

**Possible values:** [`list`]

**

data

**

Model[]

required

-

Array [

**id** stringrequired

模型的标识符

**object** stringrequired

**Possible values:** [`model`]

对象的类型，其值为 `model`。

**owned_by** stringrequired

拥有该模型的组织。

-

]

```json
{
"object": "list",
"data": [
{
"id": "string",
"object": "model",
"owned_by": "string"
}
]
}
```

```json
{
"object": "list",
"data": [
{
"id": "deepseek-v4-flash",
"object": "model",
"owned_by": "deepseek"
},
{
"id": "deepseek-v4-pro",
"object": "model",
"owned_by": "deepseek"
}
]
}
```

Loading...
