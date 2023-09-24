import { Struct, object, string } from "superstruct"
import { SQLEntity, SqlField, knownN2MSQLEntities } from "./querybuilder.js"

function superstructToSQL<T, S extends Record<string, Struct<any, any>>, N extends string>(struct: Struct<T, S>, config: { name: N, skip?: (keyof S)[] }) {
  const sqlEntity = new SQLEntity<T, N>(
    config.name,
    r => r as T,
    Object.keys(struct.schema).filter(f => !config.skip?.includes(f)).reduce((o, f) => { o[f] = new SqlField(f, config.name); return o }, {} as any),
    alias => new Proxy({}, { get: (t, p) => new SqlField(p as string, typeof alias === "string" ? alias : alias[0]) }) as any,
  )
  const sqlEntityWithProxy = new Proxy(sqlEntity, {
    get: (t, p) => {
      const prop = (sqlEntity as any)[p]
      if (prop) {
        if (typeof prop === "function") {
          return prop.bind(sqlEntity)
        } else {
          return prop
        }
      }

      const field = (sqlEntity.schema as any)[p]
      if (field) {
        return field
      }

      return (sqlEntity as any)[p]
    },
  }) as SQLEntity<T, N> & {
    [P in keyof T]-?: SqlField<T[P]>
  }

  return [sqlEntityWithProxy] as const
}

export default superstructToSQL

export const defineN2MRelation = <T0, N0 extends string, T1, N1 extends string>(table0: SQLEntity<T0, N0>, table1: SQLEntity<T1, N1>) => {
  const name = `N2M_${table0.entityName}_${table1.entityName}` as const

  const N2MSchema = object({
    [`${table0.entityName}_id` as const]: string(),
    [`${table1.entityName}_id` as const]: string(),
  })

  const [
    N2MSQL,
  ] = superstructToSQL<any, any, typeof name>(N2MSchema, {
    name,
  })

  knownN2MSQLEntities.set(`${table0.entityName}|${table1.entityName}`, { entity: N2MSQL, index: 0 })
  knownN2MSQLEntities.set(`${table1.entityName}|${table0.entityName}`, { entity: N2MSQL, index: 1 })

  return [N2MSchema, N2MSQL] as const
}
