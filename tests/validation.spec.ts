import 'reflect-metadata';
import 'jest-extended'
import {
    AddValidator,
    Field,
    InlineValidator,
    Optional, plainToClass,
    PropertyValidator,
    PropertyValidatorError,
    validate, validatedPlainToClass,
    ValidationError, ValidationFailed
} from "../";
import {CustomError} from '@marcj/estdlib';

test('test simple', async () => {
    class Page {
        constructor(
            @Field() public name: string,
            @Field() public age: number,
        ) {
        }
    }

    const errors = validate(Page, {name: 'peter'});
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(ValidationError);
    expect(errors[0].message).toBe('Required value is undefined');
    expect(errors[0].path).toBe('age');
});

test('test required', async () => {

    class Model {
        @Field()
        id: string = '1';

        @Field()
        name?: string;

        @Optional()
        optional?: string;

        @Optional()
        @Field({String})
        map?: { [name: string]: string };

        @Optional()
        @Field([String])
        array?: string[];
    }

    const instance = new Model;
    expect(validate(Model, instance)).toBeArrayOfSize(1);
    expect(validate(Model, instance)).toEqual([{code: 'required', message: "Required value is undefined", path: 'name'}]);

    expect(validate(Model, {
        name: 'foo',
        map: true
    })).toEqual([{code: 'invalid_type', message: "Invalid type. Expected object, but got boolean", path: 'map'}]);
    expect(validate(Model, {
        name: 'foo',
        array: 233
    })).toEqual([{code: 'invalid_type', message: "Invalid type. Expected array, but got number", path: 'array'}]);

    instance.name = 'Pete';
    expect(validate(Model, instance)).toEqual([]);
});


test('test deep', async () => {

    class Deep {
        @Field()
        name?: string;
    }

    class Model {
        @Field()
        id: string = '2';

        @Field(Deep)
        deep?: Deep;

        @Field([Deep])
        deepArray: Deep[] = [];

        @Field({Deep})
        deepMap: { [name: string]: Deep } = {};
    }

    const instance = new Model;
    expect(validate(Model, instance)).toBeArrayOfSize(1);
    expect(validate(Model, instance)).toEqual([{code: 'required', message: "Required value is undefined", path: 'deep'}]);

    instance.deep = new Deep();
    expect(validate(Model, instance)).toEqual([{code: 'required', message: "Required value is undefined", path: 'deep.name'}]);

    instance.deep.name = 'defined';
    instance.deepArray.push(new Deep());
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined",
        path: 'deepArray.0.name'
    }]);

    instance.deepArray[0].name = 'defined';
    instance.deepMap.foo = new Deep();
    expect(validate(Model, instance)).toEqual([{
        code: 'required',
        message: "Required value is undefined",
        path: 'deepMap.foo.name'
    }]);

    instance.deepMap.foo.name = 'defined';
    expect(validate(Model, instance)).toEqual([]);
});

test('test AddValidator', async () => {
    class MyValidator implements PropertyValidator {
        validate<T>(value: any): PropertyValidatorError | void {
            if (value.length > 5) {
                return new PropertyValidatorError('too_long', 'Too long');
            }
        }
    }

    class Model {
        @Field()
        @AddValidator(MyValidator)
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'too_long', message: 'Too long', path: 'id'}]);
});

test('test inline validator throw', async () => {
    class MyError extends CustomError {
        constructor() {
            super('Too long');
        }
    }

    class Model {
        @Field()
        @InlineValidator((value: string) => {
            if (value.length > 5) {
                throw new MyError();
            }
        })
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'MyError', message: 'Too long', path: 'id'}]);
});

test('test inline validator', async () => {
    class MyError extends Error {};

    class Model {
        @Field()
        @InlineValidator((value: string) => {
            if (value.length > 5) {
                return new PropertyValidatorError('too_long', 'Too long');
            }
        })
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: '123456'})).toEqual([{code: 'too_long', message: 'Too long', path: 'id'}]);
});

test('test Date', async () => {
    class Model {
        @Field(Date)
        public endTime!: Date;
    }

    const date = new Date("2019-03-19T10:41:45.000Z");

    expect(validate(Model, {endTime: "2019-03-19T10:38:59.072Z"})).toEqual([]);
    expect(validate(Model, {endTime: date.toJSON()})).toEqual([]);
    expect(validate(Model, {endTime: "Tue Mar 19 2019 11:39:10 GMT+0100 (Central European Standard Time)"})).toEqual([]);
    expect(validate(Model, {endTime: date.toString()})).toEqual([]);
    expect(validate(Model, {endTime: new Date()})).toEqual([]);
    expect(validate(Model, {endTime: ''})).toEqual([{code: 'invalid_date', message: 'No Date string given', path: 'endTime'}]);
    expect(validate(Model, {endTime: new Date('asdf')})).toEqual([{code: 'invalid_date', message: 'No valid Date given', path: 'endTime'}]);
    expect(validate(Model, {endTime: 'asdf'})).toEqual([{code: 'invalid_date', message: 'No valid Date string given', path: 'endTime'}]);
    expect(validate(Model, {endTime: null})).toEqual([{code: 'required', message: 'Required value is null', path: 'endTime'}]);
    expect(validate(Model, {endTime: undefined})).toEqual([{code: 'required', message: 'Required value is undefined', path: 'endTime'}]);

    {
        const o = plainToClass(Model, {endTime: date.toString()});
        expect(o.endTime).toEqual(date);
    }

    {
        const o = plainToClass(Model, {endTime: date.toJSON()});
        expect(o.endTime).toEqual(date);
    }

    {
        const o = plainToClass(Model, {endTime: null});
        expect(o.endTime).toBe(null);
    }

    {
        const o = plainToClass(Model, {endTime: undefined});
        expect(o.endTime).toBe(undefined);
    }

    {
        const o = validatedPlainToClass(Model, {endTime: '2019-03-19T10:41:45.000Z'});
        expect(o.endTime).toEqual(date);
    }

    try {
        validatedPlainToClass(Model, {endTime: 'asd'});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No valid Date string given');
    }

    try {
        validatedPlainToClass(Model, {endTime: ''});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('No Date string given');
    }

    try {
        validatedPlainToClass(Model, {endTime: null});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is null');
    }

    try {
        validatedPlainToClass(Model, {endTime: undefined});
        fail('should throw error');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailed);
        expect(error.errors[0].message).toBe('Required value is undefined');
    }

});

test('test string', async () => {
    class Model {
        @Field()
        id: string = '2';
    }

    expect(validate(Model, {id: '2'})).toEqual([]);
    expect(validate(Model, {id: 2})).toEqual([{code: 'invalid_string', message: "No String given", path: 'id'}]);
    expect(validate(Model, {id: null})).toEqual([{code: 'required', message: "Required value is null", path: 'id'}]);
    expect(validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @Field()
        @Optional()
        id?: string;
    }

    expect(validate(ModelOptional, {id: '2'})).toEqual([]);
    expect(validate(ModelOptional, {id: 2})).toEqual([{code: 'invalid_string', message: "No String given", path: 'id'}]);
    expect(validate(ModelOptional, {id: null})).toEqual([{code: 'invalid_string', message: "No String given", path: 'id'}]);
    expect(validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test number', async () => {
    class Model {
        @Field()
        id: number = 2;
    }

    expect(validate(Model, {id: 3})).toEqual([]);
    expect(validate(Model, {id: '3'})).toEqual([]);
    expect(validate(Model, {id: 'a'})).toEqual([{code: 'invalid_number', message: "No Number given", path: 'id'}]);
    expect(validate(Model, {id: null})).toEqual([{code: 'required', message: "Required value is null", path: 'id'}]);
    expect(validate(Model, {id: undefined})).toEqual([]); //because defaults are applied
    expect(validate(Model, {})).toEqual([]); //because defaults are applied

    class ModelOptional {
        @Field()
        @Optional()
        id?: number;
    }

    expect(validate(ModelOptional, {id: 3})).toEqual([]);
    expect(validate(ModelOptional, {id: '3'})).toEqual([]);
    expect(validate(ModelOptional, {id: 'a'})).toEqual([{code: 'invalid_number', message: "No Number given", path: 'id'}]);
    expect(validate(ModelOptional, {id: null})).toEqual([{code: 'invalid_number', message: "No Number given", path: 'id'}]);
    expect(validate(ModelOptional, {id: undefined})).toEqual([]);
    expect(validate(ModelOptional, {})).toEqual([]);
});

test('test nested validation', async () => {
    // Class definition with validation rules
    class A {
        @Field()
        public x!: string;
    }

    class B {
        @Field()
        public type!: string;

        @Field(A)
        public nested!: A;

        @Field({A})
        public nestedMap!: { [name: string]: A };

        @Field([A])
        public nesteds!: A[];
    }

    expect(validate(B, {
        type: "test type",
    })).toEqual([
        {'message': 'Required value is undefined', code: 'required', 'path': 'nested'},
        {'message': 'Required value is undefined', code: 'required', 'path': 'nestedMap'},
        {'message': 'Required value is undefined', code: 'required', 'path': 'nesteds'},
    ]);

    expect(validate(B, {
        type: "test type",
        nested: [{x: "test x"}],
        nestedMap: [{x: "test x"}],
        nesteds: {x: "test x"},
    })).toEqual([
        {'message': 'Invalid type. Expected object, but got array', code: 'invalid_type', 'path': 'nested'},
        {'message': 'Invalid type. Expected object, but got array', code: 'invalid_type', 'path': 'nestedMap'},
        {'message': 'Invalid type. Expected array, but got object', code: 'invalid_type', 'path': 'nesteds'},
    ]);

    class BOptional {
        @Field()
        public type!: string;

        @Field(A)
        @Optional()
        public nested!: A;
    }

    expect(validate(BOptional, {
        type: "test type",
    })).toEqual([]);

    expect(validate(BOptional, {
        type: "test type",
        nested: false,
    })).toEqual([
        {'message': 'Invalid type. Expected object, but got boolean', code: 'invalid_type', 'path': 'nested'},
    ]);

});
