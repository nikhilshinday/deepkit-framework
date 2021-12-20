import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import bson, { Binary } from 'bson';
import { deserializeBSON, getBSONDeserializer } from '../src/bson-deserializer';
import { BinaryBigInt, MongoId, nodeBufferToArrayBuffer, PrimaryKey, Reference, SignedBinaryBigInt, typeOf, uuid, UUID } from '@deepkit/type';
import { getClassName } from '@deepkit/core';

const { deserialize, serialize } = bson;

test('basic number', () => {
    const obj = { v: 123 };
    const bson = serialize(obj);

    const schema = typeOf<{
        v: number
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(getBSONDeserializer(schema)(serialize({ v: '123' }))).toEqual(obj);
    expect(getBSONDeserializer(schema)(serialize({ v: true }))).toEqual({ v: 1 });
    expect(getBSONDeserializer(schema)(serialize({ v: false }))).toEqual({ v: 0 });
    expect(getBSONDeserializer(schema)(serialize({ v: -1234 }))).toEqual({ v: -1234 });
    expect(() => getBSONDeserializer(schema)(serialize({ v: {} }))).toThrow(`Cannot convert bson type OBJECT to number`);
});

test('basic bigint', () => {
    const obj = { v: 123n };
    const bson = serialize({ v: 123 });

    const schema = typeOf<{
        v: bigint
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(getBSONDeserializer(schema)(serialize({ v: '123' }))).toEqual(obj);
    expect(getBSONDeserializer(schema)(serialize({ v: true }))).toEqual({ v: 1n });
    expect(getBSONDeserializer(schema)(serialize({ v: false }))).toEqual({ v: 0n });
    expect(() => getBSONDeserializer(schema)(serialize({ v: {} }))).toThrow(`Cannot convert bson type OBJECT to bigint`);
});

test('basic null', () => {
    const schema = typeOf<{
        v: null
    }>();
    expect(getBSONDeserializer(schema)(serialize({ v: null }))).toEqual({ v: null });
    expect(getBSONDeserializer(schema)(serialize({ v: undefined }))).toEqual({ v: null });
    expect(getBSONDeserializer(schema)(serialize({}))).toEqual({ v: null });
    expect(() => getBSONDeserializer(schema)(serialize({ v: 123 }))).toThrow(`Cannot convert bson type INT to null`);
    expect(() => getBSONDeserializer(schema)(serialize({ v: {} }))).toThrow(`Cannot convert bson type OBJECT to null`);

    expect(deserializeBSON<{ v: null }>(serialize({ v: null }))).toEqual({ v: null });
    expect(deserializeBSON<{ v?: null }>(serialize({ v: null }))).toEqual({ v: null });
    expect(deserializeBSON<{ v?: null }>(serialize({ v: undefined }))).toEqual({ v: undefined });
});

test('basic undefined', () => {
    const schema = typeOf<{
        v: undefined
    }>();
    expect(getBSONDeserializer(schema)(serialize({ v: null }))).toEqual({ v: undefined });
    expect(getBSONDeserializer(schema)(serialize({ v: undefined }))).toEqual({ v: undefined });
    expect(getBSONDeserializer(schema)(serialize({}))).toEqual({ v: undefined });
    expect(() => getBSONDeserializer(schema)(serialize({ v: 123 }))).toThrow(`Cannot convert bson type INT to undefined`);
    expect(() => getBSONDeserializer(schema)(serialize({ v: {} }))).toThrow(`Cannot convert bson type OBJECT to undefined`);
});

test('basic literal', () => {
    expect(deserializeBSON<{ v: 'abc' }>(serialize({ v: null }))).toEqual({ v: 'abc' });
    expect(deserializeBSON<{ v: 'abc' }>(serialize({ v: undefined }))).toEqual({ v: 'abc' });
    expect(deserializeBSON<{ v: 'abc' }>(serialize({}))).toEqual({ v: 'abc' });
    expect(deserializeBSON<{ v: 'abc' }>(serialize({ v: 1234 }))).toEqual({ v: 'abc' });

    expect(deserializeBSON<{ v: 123 }>(serialize({ v: 'abc' }))).toEqual({ v: 123 });
    expect(deserializeBSON<{ v: true }>(serialize({ v: 'abc' }))).toEqual({ v: true });
});

test('basic optional', () => {
    expect(deserializeBSON<{ v?: string }>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    expect(deserializeBSON<{ v?: string }>(serialize({ v: null }))).toEqual({ v: undefined });
    expect(deserializeBSON<{ v?: string }>(serialize({ v: undefined }))).toEqual({ v: undefined });
});

test('basic date', () => {
    const date = new Date;
    expect(deserializeBSON<{ v: Date }>(serialize({ v: date }))).toEqual({ v: date });
    expect(deserializeBSON<{ v: Date }>(serialize({ v: date.toJSON() }))).toEqual({ v: date });
    expect(deserializeBSON<{ v: Date }>(serialize({ v: date.valueOf() }))).toEqual({ v: date });
});

test('basic class with constructor', () => {
    class User {
        id: number = 0;

        constructor(public username: string) {
        }
    }

    {
        const user = deserializeBSON<User>(serialize({ username: 'Peter' }));
        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(0);
    }

    {
        const user = deserializeBSON<User>(serialize({ id: 3, username: 'Peter' }));
        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(3);
    }
});

test('basic class no constructor', () => {
    class User {
        id: number = 0;
        username!: string;
    }

    {
        const user = deserializeBSON<User>(serialize({ username: 'Peter' }));
        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(0);
    }

    {
        const user = deserializeBSON<User>(serialize({ id: 3, username: 'Peter' }));
        expect(user).toBeInstanceOf(User);
        expect(user.username).toBe('Peter');
        expect(user.id).toBe(3);
    }
});

test('basic optional property with initializer', () => {
    const defaultValue = new Date;

    class User {
        v: Date = defaultValue;
    }

    expect(deserializeBSON<User>(serialize({ v: new Date(1) }))).toEqual({ v: new Date(1) });
    expect(deserializeBSON<User>(serialize({ v: undefined }))).toEqual({ v: defaultValue });
    expect(deserializeBSON<User>(serialize({ v: null }))).toEqual({ v: defaultValue });
    expect(deserializeBSON<User>(serialize({}))).toEqual({ v: defaultValue });
});

test('basic binary bigint', () => {
    const buffer = Buffer.from([100]);
    const obj = { v: 100n };
    const bson = serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) });

    const schema = typeOf<{
        v: BinaryBigInt
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(getBSONDeserializer(schema)(serialize({ v: '123' }))).toEqual({ v: 123n });
    expect(getBSONDeserializer(schema)(serialize({ v: true }))).toEqual({ v: 1n });
    expect(getBSONDeserializer(schema)(serialize({ v: false }))).toEqual({ v: 0n });
    expect(() => getBSONDeserializer(schema)(serialize({ v: {} }))).toThrow(`Cannot convert bson type OBJECT to BinaryBigInt`);
});

test('basic signed binary bigint', () => {
    const buffer = Buffer.from([0, 100]);
    const obj = { v: 100n };
    const bson = serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) });
    const bsonNegative = serialize({ v: new Binary(Buffer.from([255, 100]), Binary.SUBTYPE_DEFAULT) });

    const schema = typeOf<{
        v: SignedBinaryBigInt
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(getBSONDeserializer(schema)(bsonNegative)).toEqual({ v: -100n });
    expect(getBSONDeserializer(schema)(serialize({ v: '123' }))).toEqual({ v: 123n });
    expect(getBSONDeserializer(schema)(serialize({ v: true }))).toEqual({ v: 1n });
    expect(getBSONDeserializer(schema)(serialize({ v: false }))).toEqual({ v: 0n });
    expect(() => getBSONDeserializer(schema)(serialize({ v: {} }))).toThrow(`Cannot convert bson type OBJECT to SignedBinaryBigInt`);
});

test('basic string', () => {
    const obj = { v: 'abc' };
    const bson = serialize(obj);

    const schema = typeOf<{
        v: string
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(getBSONDeserializer(schema)(serialize({ v: 123 }))).toEqual({ v: '123' });
    expect(() => getBSONDeserializer(schema)(serialize({ v: {} }))).toThrow(`Cannot convert bson type OBJECT to string`);
});

test('basic boolean', () => {
    const obj = { v: true };
    const bson = serialize(obj);

    const schema = typeOf<{
        v: boolean
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(getBSONDeserializer(schema)(serialize({ v: 123 }))).toEqual({ v: true });
    expect(getBSONDeserializer(schema)(serialize({ v: 0 }))).toEqual({ v: false });
    expect(() => getBSONDeserializer(schema)(serialize({ v: '123' }))).toThrow(`Cannot convert bson type STRING to boolean`);
});

test('basic array buffer', () => {
    const buffer = Buffer.allocUnsafe(16);
    const obj = { v: nodeBufferToArrayBuffer(buffer) };
    const bson = serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) });

    const schema = typeOf<{
        v: ArrayBuffer
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(() => getBSONDeserializer(schema)(serialize({ v: '123' }))).toThrow(`Cannot convert bson type STRING to ArrayBuffer`);
});

test('basic typed array', () => {
    const buffer = Buffer.allocUnsafe(16);
    const obj = { v: new Uint8Array(buffer) };
    const bson = serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) });

    const schema = typeOf<{
        v: Uint8Array
    }>();
    expect(getBSONDeserializer(schema)(bson)).toEqual(obj);
    expect(() => getBSONDeserializer(schema)(serialize({ v: '123' }))).toThrow(`Cannot convert bson type STRING to Uint8Array`);
});


test('basic union with typed array', () => {
    const buffer = Buffer.allocUnsafe(16);
    expect(deserializeBSON<{ v: string | Uint8Array }>(serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) }))).toEqual({ v: new Uint8Array(buffer) });
    expect(deserializeBSON<{ v: string | Uint8Array }>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    expect(() => deserializeBSON<{ v: string | Uint8Array }>(serialize({ v: {} }))).toThrow('Cannot convert bson type OBJECT to string | Uint8Array');
});

test('basic union with arraybuffer', () => {
    const buffer = Buffer.allocUnsafe(16);
    expect(deserializeBSON<{ v: string | ArrayBuffer }>(serialize({ v: new Binary(buffer, Binary.SUBTYPE_DEFAULT) }))).toEqual({ v: nodeBufferToArrayBuffer(buffer) });
    expect(deserializeBSON<{ v: string | ArrayBuffer }>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    expect(() => deserializeBSON<{ v: string | ArrayBuffer }>(serialize({ v: {} }))).toThrow('Cannot convert bson type OBJECT to string | ArrayBuffer');
});

test('basic union ', () => {
    expect(deserializeBSON<{ v: string | number }>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    expect(deserializeBSON<{ v: string | number }>(serialize({ v: 123 }))).toEqual({ v: 123 });
    expect(() => deserializeBSON<{ v: string | number }>(serialize({ v: undefined }))).toThrow('Cannot convert undefined value to string | number');
    expect(() => deserializeBSON<{ v: string | number }>(serialize({}))).toThrow('Cannot convert undefined value to string | number');
    expect(deserializeBSON<{ v?: string | number }>(serialize({ v: undefined }))).toEqual({ v: undefined });
    expect(deserializeBSON<{ v?: string | number }>(serialize({ v: null }))).toEqual({ v: undefined });
    expect(deserializeBSON<{ v?: string | number }>(serialize({}))).toEqual({ v: undefined });
});

test('basic union with null', () => {
    expect(deserializeBSON<{ v: string | null }>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    expect(deserializeBSON<{ v: string | null }>(serialize({ v: null }))).toEqual({ v: null });
    expect(deserializeBSON<{ v?: string | null }>(serialize({ v: null }))).toEqual({ v: null });
    expect(deserializeBSON<{ v?: string | null }>(serialize({ v: undefined }))).toEqual({ v: undefined });
});

test('basic union with literals', () => {
    expect(deserializeBSON<{ v: 'a' | 'b' }>(serialize({ v: 'a' }))).toEqual({ v: 'a' });
    expect(deserializeBSON<{ v: 'a' | string }>(serialize({ v: 'a' }))).toEqual({ v: 'a' });
    expect(deserializeBSON<{ v: 'a' | string }>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });

    expect(deserializeBSON<{ v: 'a' | 2 }>(serialize({ v: 'a' }))).toEqual({ v: 'a' });
    expect(deserializeBSON<{ v: 'a' | 2 }>(serialize({ v: 'a' }))).toEqual({ v: 'a' });
    expect(deserializeBSON<{ v: 'a' | 2, num: number }>(serialize({ v: 2, num: 5 }))).toEqual({ v: 2, num: 5 });
    expect(deserializeBSON<{ v: true | number }>(serialize({ v: 2 }))).toEqual({ v: 2 });
    expect(deserializeBSON<{ v: true | number }>(serialize({ v: true }))).toEqual({ v: true });
    expect(deserializeBSON<{ v: true | number }>(serialize({ v: false }))).toEqual({ v: 0 });
});

test('basic union with template literals', () => {
    expect(deserializeBSON<{ v: `a${number}` | number }>(serialize({ v: 'a123' }))).toEqual({ v: 'a123' });
    expect(deserializeBSON<{ v: `a${number}` | number }>(serialize({ v: 123 }))).toEqual({ v: 123 });
    expect(deserializeBSON<{ v?: `a${number}` | number }>(serialize({ v: undefined }))).toEqual({ v: undefined });
});

test('basic template literal', () => {
    expect(deserializeBSON<{ v: `a${number}` }>(serialize({ v: 'a123' }))).toEqual({ v: 'a123' });
    expect(deserializeBSON<{ v: `a${number}` }>(serialize({ v: 'a1' }))).toEqual({ v: 'a1' });
    expect(() => deserializeBSON<{ v: `a${number}` }>(serialize({ v: 'a' }))).toThrow('Cannot convert a to `a${number}`');
    expect(() => deserializeBSON<{ v: `a${number}` }>(serialize({ v: 'abc' }))).toThrow('Cannot convert abc to `a${number}`');
    expect(() => deserializeBSON<{ v: `a${number}` }>(serialize({ v: false }))).toThrow('Cannot convert bson type BOOLEAN to `a${number}`');
    expect(() => deserializeBSON<{ v: `a${number}` }>(serialize({ v: 234 }))).toThrow('Cannot convert bson type INT to `a${number}`');
});

test('basic uuid', () => {
    const myUuid = uuid();
    expect(deserializeBSON<{ v: UUID }>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
    expect(() => deserializeBSON<{ v: UUID }>(serialize({ v: 'asd' }))).toThrow('Cannot convert asd to UUID');
    expect(() => deserializeBSON<{ v: UUID }>(serialize({ v: 0 }))).toThrow('Cannot convert 0 to UUID');
});

test('basic mongoId', () => {
    const myObjectId = '507f1f77bcf86cd799439011';
    expect(deserializeBSON<{ v: MongoId }>(serialize({ v: myObjectId }))).toEqual({ v: myObjectId });
    expect(() => deserializeBSON<{ v: MongoId }>(serialize({ v: 'asd' }))).toThrow('Cannot convert asd to MongoId.');
    expect(() => deserializeBSON<{ v: MongoId }>(serialize({ v: 0 }))).toThrow('Cannot convert 0 to MongoId.');
});

test('basic union with string | uuid', () => {
    const myUuid = uuid();
    expect(deserializeBSON<{ v: string | UUID }>(serialize({ v: 'abc' }))).toEqual({ v: 'abc' });
    expect(deserializeBSON<{ v: string | UUID }>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
    expect(deserializeBSON<{ v: string | UUID }>(serialize({ v: 23 }))).toEqual({ v: '23' });
});

test('basic union with number | uuid', () => {
    const myUuid = uuid();
    expect(deserializeBSON<{ v: number | UUID }>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
    expect(deserializeBSON<{ v: number | UUID }>(serialize({ v: 23 }))).toEqual({ v: 23 });
    expect(() => deserializeBSON<{ v: number | UUID }>(serialize({ v: 'asdad' }))).toThrow('Cannot convert bson type STRING to number');
});

test('basic union with null | uuid', () => {
    const myUuid = uuid();
    expect(deserializeBSON<{ v: null | UUID }>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
    expect(deserializeBSON<{ v: null | UUID }>(serialize({ v: null }))).toEqual({ v: null });
    expect(() => deserializeBSON<{ v: null | UUID }>(serialize({ v: 'asdad' }))).toThrow('Cannot convert bson type STRING to null | UUID');
});

test('basic union with uuid', () => {
    const myUuid = uuid();
    expect(deserializeBSON<{ v: number | UUID }>(serialize({ v: 23 }))).toEqual({ v: 23 });
    expect(deserializeBSON<{ v: number | UUID }>(serialize({ v: myUuid }))).toEqual({ v: myUuid });
    expect(() => deserializeBSON<{ v: UUID | undefined }>(serialize({ v: 'asdad' }))).toThrow('Cannot convert asdad to UUID');
    expect(() => deserializeBSON<{ v: number | UUID }>(serialize({ v: 'asdad' }))).toThrow('Cannot convert bson type STRING to number');
});

test('basic union with Date', () => {
    const value = new Date;
    expect(deserializeBSON<{ v: number | Date }>(serialize({ v: 23 }))).toEqual({ v: 23 });
    expect(deserializeBSON<{ v: number | Date }>(serialize({ v: value }))).toEqual({ v: value });
    expect(deserializeBSON<{ v: number | Date }>(serialize({ v: true }))).toEqual({ v: 1 });
    expect(() => deserializeBSON<{ v: number | Date }>(serialize({}))).toThrow('Cannot convert undefined value to number | Date');
});

test('basic regexp', () => {
    const myRegexp = /abc/gmi;
    expect(deserializeBSON<{ v: RegExp }>(serialize({ v: myRegexp }))).toEqual({ v: myRegexp });
    expect(() => deserializeBSON<{ v: RegExp }>(serialize({ v: 'abc' }))).toThrow('Cannot convert bson type STRING to RegExp');
    expect(() => deserializeBSON<{ v: RegExp }>(serialize({ v: 23 }))).toThrow('Cannot convert bson type INT to RegExp');
    expect(() => deserializeBSON<{ v: RegExp }>(serialize({}))).toThrow('Cannot convert undefined value to RegExp');
});

test('basic union with regexp', () => {
    const myRegexp = /abc/gmi;
    expect(deserializeBSON<{ v: number | RegExp }>(serialize({ v: myRegexp }))).toEqual({ v: myRegexp });
    expect(deserializeBSON<{ v: number | RegExp }>(serialize({ v: 23 }))).toEqual({ v: 23 });
    expect(() => deserializeBSON<{ v: number | RegExp }>(serialize({ v: {} }))).toThrow('Cannot convert bson type OBJECT to number | RegExp');
    expect(() => deserializeBSON<{ v: number | RegExp }>(serialize({}))).toThrow('Cannot convert undefined value to number | RegExp');
});

test('basic array', () => {
    const value = ['a', 'b', 'c'];
    expect(deserializeBSON<{ v: string[] }>(serialize({ v: value }))).toEqual({ v: value });
    expect(deserializeBSON<{ v: string[] }>(serialize({ v: [1, 'b'] }))).toEqual({ v: ['1', 'b'] });
    expect(() => deserializeBSON<{ v: string[] }>(serialize({ v: 123 }))).toThrow('Cannot convert bson type INT to string[]');
    expect(() => deserializeBSON<{ v: string[] }>(serialize({ v: [{}] }))).toThrow('Cannot convert bson type OBJECT to string');
});

test('basic array union', () => {
    const value = ['a', 'b', false, 'c', true];
    expect(deserializeBSON<{ v: (string | boolean)[] }>(serialize({ v: value }))).toEqual({ v: value });
    expect(() => deserializeBSON<{ v: (string | boolean)[] }>(serialize({ v: 123 }))).toThrow('Cannot convert bson type INT to (string | boolean)[]');
    expect(() => deserializeBSON<{ v: (string | boolean)[] }>(serialize({ v: ['a', {}] }))).toThrow('Cannot convert bson type OBJECT to string | boolean');
});

test('basic two array union', () => {
    const value = ['a', 'b', false, 'c', true];
    type t = (string | boolean)[] | number[];
    expect(deserializeBSON<{ v: t }>(serialize({ v: value }))).toEqual({ v: value });
    expect(deserializeBSON<{ v: t }>(serialize({ v: [1, 2] }))).toEqual({ v: [1, 2] });
    expect(() => deserializeBSON<{ v: t }>(serialize({ v: 123 }))).toThrow('Cannot convert bson type INT to (string | boolean)[]');
    expect(() => deserializeBSON<{ v: t }>(serialize({ v: ['a', {}] }))).toThrow('Cannot convert bson type ARRAY to (string | boolean)[] | number[]');
});

test('basic loosely array union', () => {
    const value = ['a', 'b', false, 'c', true];
    type t = (string | boolean)[] | number;
    expect(deserializeBSON<{ v: t }>(serialize({ v: value }))).toEqual({ v: value });

    //when resolving an complicated union, we do not use loosely type guards
    expect(() => deserializeBSON<{ v: t }>(serialize({ v: [1, 2] }))).toThrow('Cannot convert bson type ARRAY to (string | boolean)[] | number');

    expect(deserializeBSON<{ v: t }>(serialize({ v: 123 }))).toEqual({ v: 123 });
    expect(() => deserializeBSON<{ v: t }>(serialize({ v: ['a', {}] }))).toThrow('Cannot convert bson type ARRAY to (string | boolean)[] | number');
});

test('basic class array union', () => {
    class A {
        type!: 'a';
        b?: number;
    }

    class B {
        type!: 'b';
    }

    class C {
        c!: string;
    }

    type t = (A)[] | (B)[] | (C)[];
    {
        const items = deserializeBSON<{ v: t }>(serialize({ v: [{ type: 'a' }] }));
        expect(items.v[0]).toBeInstanceOf(A);
        expect((items.v[0] as A).type).toBe('a');
    }

    {
        const items = deserializeBSON<{ v: t }>(serialize({ v: [{ type: 'b' }] }));
        expect(items.v[0]).toBeInstanceOf(B);
        expect((items.v[0] as B).type).toBe('b');
    }

    {
        const items = deserializeBSON<{ v: t }>(serialize({ v: [{ c: 'yes' }] }));
        expect(items.v[0]).toBeInstanceOf(C);
        expect((items.v[0] as C).c).toBe('yes');
    }

    {
        expect(() => deserializeBSON<{ v: t }>(serialize({ v: [{ nope: 'no' }] }))).toThrow(`Cannot convert bson type ARRAY to A { type: 'a'; b?: number;}[] | B { type: 'b';}[] | C { c: string;}[]`);
    }
});

test('constructor parameters', () => {
    class A {
        id: number = 0;

        constructor(public username: string) {
        }
    }

    expect(deserializeBSON<{ v: A }>(serialize({ v: new A('Peter') }))).toEqual({ v: { id: 0, username: 'Peter' } });
});

test('reference', () => {
    class A {
        id: number & PrimaryKey = 0;

        constructor(public username: string) {
        }
    }

    {
        const item = deserializeBSON<{ v: A & Reference }>(serialize({ v: 23 }));
        expect(item).toEqual({ v: { id: 23 } });
        expect(item.v).toBeInstanceOf(A);
        expect(getClassName(item.v)).toBe('AReference');
    }

    {
        const item = deserializeBSON<{ v: A & Reference }>(serialize({ v: { id: 34, username: 'Peter' } }));
        expect(item).toEqual({ v: { id: 34, username: 'Peter' } });
        expect(item.v).toBeInstanceOf(A);
        expect(getClassName(item.v)).toBe('A');
    }
});

test('reference in union', () => {
    class A {
        id: number & PrimaryKey = 0;

        constructor(public username: string) {
        }
    }

    type t = { v: (A & Reference) | string[] };

    {
        const item = deserializeBSON<t>(serialize({ v: 23 }));
        expect(item).toEqual({ v: { id: 23 } });
        expect(item.v).toBeInstanceOf(A);
        expect(getClassName(item.v)).toBe('AReference');
    }

    {
        const item = deserializeBSON<t>(serialize({ v: { id: 34, username: 'Peter' } }));
        expect(item).toEqual({ v: { id: 34, username: 'Peter' } });
        expect(item.v).toBeInstanceOf(A);
        expect(getClassName(item.v)).toBe('A');
    }
});

test('tuple', () => {
    {
        type t = { v: [string, number] };
        expect(deserializeBSON<t>(serialize({ v: ['abc', 34] }))).toEqual({ v: ['abc', 34] });
        expect(deserializeBSON<t>(serialize({ v: ['abc', 34, 55] }))).toEqual({ v: ['abc', 34] });
        expect(deserializeBSON<t>(serialize({ v: ['abc', '44'] }))).toEqual({ v: ['abc', 44] });
    }
    {
        type t = { v: [number] };
        expect(deserializeBSON<t>(serialize({ v: [34] }))).toEqual({ v: [34] });
        expect(deserializeBSON<t>(serialize({ v: ['44'] }))).toEqual({ v: [44] });
    }
    {
        type t = { v: [...number[]] };
        expect(deserializeBSON<t>(serialize({ v: [34] }))).toEqual({ v: [34] });
        expect(deserializeBSON<t>(serialize({ v: ['44'] }))).toEqual({ v: [44] });
        expect(deserializeBSON<t>(serialize({ v: [34, 55] }))).toEqual({ v: [34, 55] });
        expect(deserializeBSON<t>(serialize({ v: ['44', 55] }))).toEqual({ v: [44, 55] });
    }
    {
        type t = { v: [string, ...number[]] };
        expect(deserializeBSON<t>(serialize({ v: [34] }))).toEqual({ v: ['34'] });
        expect(deserializeBSON<t>(serialize({ v: ['44'] }))).toEqual({ v: ['44'] });
        expect(deserializeBSON<t>(serialize({ v: [34, 55] }))).toEqual({ v: ['34', 55] });
        expect(deserializeBSON<t>(serialize({ v: ['44', 55, 66] }))).toEqual({ v: ['44', 55, 66] });
    }
    {
        type t = { v: [...number[], string] };
        expect(deserializeBSON<t>(serialize({ v: [34] }))).toEqual({ v: ['34'] });
        expect(deserializeBSON<t>(serialize({ v: ['44'] }))).toEqual({ v: ['44'] });
        expect(deserializeBSON<t>(serialize({ v: [34, '55'] }))).toEqual({ v: [34, '55'] });
        expect(deserializeBSON<t>(serialize({ v: ['44', 55, '66'] }))).toEqual({ v: [44, 55, '66'] });
    }
    {
        type t = { v: [...number[], string, boolean] };
        expect(deserializeBSON<t>(serialize({ v: [true] }))).toEqual({ v: [true] });
        expect(deserializeBSON<t>(serialize({ v: [34, true] }))).toEqual({ v: ['34', true] });
        expect(deserializeBSON<t>(serialize({ v: ['44', 55, '66', true] }))).toEqual({ v: [44, 55, '66', true] });
    }
    {
        type t = { v: [string, ...number[], boolean] };
        expect(deserializeBSON<t>(serialize({ v: ['abc', true] }))).toEqual({ v: ['abc', true] });
        expect(deserializeBSON<t>(serialize({ v: ['abc', 12, true] }))).toEqual({ v: ['abc', 12, true] });
        expect(deserializeBSON<t>(serialize({ v: ['abc', 12, 23, true] }))).toEqual({ v: ['abc', 12, 23, true] });
    }
});

test('tuple on union', () => {
    interface C {
        d: true;
    }

    {
        type t = { v: [string, number] | [C] };
        expect(deserializeBSON<t>(serialize({ v: ['abc', 34] }))).toEqual({ v: ['abc', 34] });
        expect(deserializeBSON<t>(serialize({ v: [{ d: true }] }))).toEqual({ v: [{ d: true }] });
        expect(deserializeBSON<t>(serialize({ v: ['abc', 34, 55] }))).toEqual({ v: ['abc', 34] });
        expect(() => deserializeBSON<t>(serialize({ v: ['abc', '44'] }))).toThrow('Cannot convert bson type ARRAY to [string, number] | [C]'); //union type guard are strict
    }
    {
        type t = { v: [number] | [C] };
        expect(deserializeBSON<t>(serialize({ v: [34] }))).toEqual({ v: [34] });
        expect(() => deserializeBSON<t>(serialize({ v: ['44'] }))).toThrow('Cannot convert bson type ARRAY to [number]'); //union type guard are strict
    }
    {
        type t = { v: [...number[]] | [C] };
        expect(deserializeBSON<t>(serialize({ v: [34] }))).toEqual({ v: [34] });
        expect(() => deserializeBSON<t>(serialize({ v: ['44'] }))).toThrow('Cannot convert bson type ARRAY to [...number[]] | [C]');
        expect(deserializeBSON<t>(serialize({ v: [34, 55] }))).toEqual({ v: [34, 55] });
        expect(() => deserializeBSON<t>(serialize({ v: ['44', 55] }))).toThrow('Cannot convert bson type ARRAY to [...number[]] | [C]');
    }
    {
        type t = { v: [string, ...number[]] | [C] };
        expect(deserializeBSON<t>(serialize({ v: ['44'] }))).toEqual({ v: ['44'] });
        expect(() => deserializeBSON<t>(serialize({ v: [34] }))).toThrow();
        expect(() => deserializeBSON<t>(serialize({ v: [34, 55] }))).toThrow();
        expect(deserializeBSON<t>(serialize({ v: ['44', 55, 66] }))).toEqual({ v: ['44', 55, 66] });
    }
    {
        type t = { v: [...number[], string] | [C] };
        expect(deserializeBSON<t>(serialize({ v: ['44'] }))).toEqual({ v: ['44'] });
        expect(() => deserializeBSON<t>(serialize({ v: [34] }))).toThrow();
        expect(deserializeBSON<t>(serialize({ v: [34, '55'] }))).toEqual({ v: [34, '55'] });
        expect(() => deserializeBSON<t>(serialize({ v: ['44', 55, '66'] }))).toThrow();
    }
    {
        type t = { v: [...number[], string, boolean] | [C] };
        expect(deserializeBSON<t>(serialize({ v: [true] }))).toEqual({ v: [true] });
        expect(() => deserializeBSON<t>(serialize({ v: [34, true] }))).toThrow();
        expect(deserializeBSON<t>(serialize({ v: [44, 55, '66', true] }))).toEqual({ v: [44, 55, '66', true] });
    }
    {
        type t = { v: [string, ...number[], boolean] | [C] };
        expect(deserializeBSON<t>(serialize({ v: ['abc', true] }))).toEqual({ v: ['abc', true] });
        expect(deserializeBSON<t>(serialize({ v: ['abc', 12, true] }))).toEqual({ v: ['abc', 12, true] });
        expect(deserializeBSON<t>(serialize({ v: ['abc', 12, 23, true] }))).toEqual({ v: ['abc', 12, 23, true] });
    }
});

test('set', () => {
    {
        type t = { v: Set<string> };
        expect(deserializeBSON<t>(serialize({ v: ['abc', 34] }))).toEqual({ v: new Set(['abc', '34']) });
    }
});

test('set in union', () => {
    interface C {
        d: true;
    }

    {
        type t = { v: Set<string> | [C] };
        expect(deserializeBSON<t>(serialize({ v: ['abc', '34'] }))).toEqual({ v: new Set(['abc', '34']) });
        expect(deserializeBSON<t>(serialize({ v: [{ d: true }] }))).toEqual({ v: [{ d: true }] });
    }
});

test('map', () => {
    {
        type t = { v: Map<string, number> };
        expect(deserializeBSON<t>(serialize({ v: [['a', 23], ['b', 34]] }))).toEqual({ v: new Map<any, any>([['a', 23], ['b', 34]]) });
    }
});

test('map union', () => {
    interface C {
        d: true;
    }

    {
        type t = { v: Map<string, number> | [C] };
        expect(deserializeBSON<t>(serialize({ v: [['a', 23], ['b', 34]] }))).toEqual({ v: new Map<any, any>([['a', 23], ['b', 34]]) });
        expect(deserializeBSON<t>(serialize({ v: [{d: true}] }))).toEqual({ v: [{d: true}] });
    }
});
