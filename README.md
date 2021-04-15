# flow-validator

![Test suite](https://github.com/onify/flow-validator/workflows/Test%20suite/badge.svg)

Validate you Onify Flow.

<!-- toc -->

- [Flow Validator](#flow-validator)
- [Onify Flow Introduction](#onify-flow-introduction)
- [Timers](#timers)
  - [`timeDuration`](#timeduration)
  - [`timeCycle`](#timecycle)
  - [`timeDate`](#timedate)
- [Input/Output](#inputoutput)
  - [Expressions](#expressions)
  - [Input parameters](#input-parameters)
    - [Process state](#process-state)
  - [Output parameters](#output-parameters)
    - [Process state](#process-state)
  - [Process status](#process-status)
- [ServiceTasks](#servicetasks)
  - [`onifyApiRequest(options[, callback])`](#onifyapirequestoptions-callback)
  - [`onifyElevatedApiRequest(options[, callback])`](#onifyelevatedapirequestoptions-callback)
  - [`httpRequest(options[, callback])`](#httprequestoptions-callback)
- [JavaScript](#javascript)
  - [Global context](#global-context)
    - [`fields`](#fields)
    - [`content`](#content)
    - [`properties`](#properties)
    - [`environment`](#environment)
    - [`contextName`](#contextname)
    - [`next(err, result)`](#nexterr-result)
    - [`Buffer.from(...args)`](#bufferfromargs)
      - [Encode as base64](#encode-as-base64)
      - [Decode base64](#decode-base64)
    - [`console.log(...args)`](#consolelogargs)
    - [`decrypt(encryptedText, encoding = 'hex')`](#decryptencryptedtext-encoding--hex)
    - [`encrypt(text, encoding = 'hex')`](#encrypttext-encoding--hex)
    - [`jwt.sign(...)`](#jwtsign)
    - [`jwt.verify(...)`](#jwtverify)

<!-- tocstop -->

# Flow Validator

Mocha example

```js
const FlowValidator = require('@onify/flow-validator');
const {expect} = require('chai');
const {promises: fs} = require('fs');

describe('all my flows are valid', () => {
  let source, validator;
  before(async () => {
    source = await fs.readFile('./resources/happy-trail.bpmn');
    validator = FlowValidator(source);
  });

  it('model has no errors', async () => {
    const {warnings} = await validator.validate();
    const message = warnings.map(({message}) => message).join('\n');
    expect(warnings, message).to.have.length(0);
  });

  it('scripts have no linting errors', async () => {
    const linting = await validator.lint();
    expect(linting, linting).to.have.length(0);
  });

  it('but I know we have some console.logs, it\'s OK', async () => {
    const {linting} = await validator.validate({
      rules: {
        'no-console': 2,
      }
    });
    expect(linting, linting).to.have.length.above(0);
    expect(linting[0]).to.contain('no-console');
  });
});
````

# Onify Flow Introduction

Onify flow is based on the open source workflow engine [bpmn-engine](https://github.com/paed01/bpmn-engine).

# Timers

Onify flow supports timers, i.e. [TimerEventDefinition's](https://github.com/paed01/bpmn-elements/blob/master/docs/TimerEventDefinition.md) with one addition. Onify also supports time cycle using cron.

## `timeDuration`

Suitable for activity timeouts. Duration is defined using ISO8601 duration

## `timeCycle`

Suitable for scheduled flows. Cycle is defined using cron.

## `timeDate`

Suitable for scheduled flows. Date should be set using `new Date()` or in ISO format.

# Input/Output

When modelling a flow for Onify it is possible to define activity Input/Output parameters. Onify has some special handling of the content of that.

1. If a parameter with the same name appears the parameter will be overwritten with the new value
2. If a Map is used the Map will be converted into an object
3. If a Map contains fields with the same name the field will be converted into an Array and the values will be pushed

## Expressions

Input/output parameters can be set using expressions. The [bpmn-engine](https://github.com/paed01/bpmn-engine) has built in expression handling that is documented [here](https://github.com/paed01/bpmn-elements/blob/master/docs/Expression.md).

Tip! Since all parameter values are treated as strings, typed booleans and numbers can defined using: `${true}`, `${false}`, or `${1234}`.

## Input parameters

Input parameters will be available under [`content.input`](#content).

### Process state

If a `state` input parameter is defined it will be mapped as process state. States can be one or many. The input parameter can be either a Map or a script returning an object.

Example Map:

| field name    | type               | description               |
|---------------|--------------------|---------------------------|
| `id`          | string             | example: `state-1`        |
| `name`        | (optional) string  | example: `My first state` |
| `order`       | (optional) integer | display order             |
| `description` | (optional) string  | description               |
| `user`        | (optional) array   | allowed user              |
| `role`        | (optional) array   | allowed roles             |

## Output parameters

Input parameters will be available under [`content.output`](#content).

### Process state

If a `state` output parameter is defined it will be mapped as process state. States can be one or many. The output parameter can be either a Map or a script returning an object.

A script can be preferred since a complex object can be set:
```js
next(null, {
  id: 'state-1',
  result: {
    done: true,
    error: false,
    skipped: false,
    timestamp: new Date(),
    statuscode: 200,
    statusmessage: 'OK',
    link: '/',
    link_text: 'Back to root',
    user: ''
  }
});
```

> Not all properties of result has to be used

## Process status

Input/Output can also be used to manipulate process status using a parameter named `status`. The status can contain the following properties:

Example Map:

| field name     | type               | description                                                       |
|----------------|--------------------|-------------------------------------------------------------------|
| `statuskey`    | (optional) string  | can be one of `start`, `continue`, `complete`, `pause`, or `stop` |
| `statuscode`   | (optional) integer | HTTP status code                                                  |
| `statusmessage`| (optional) string  | Status message                                                    |
| `error`        | (optional) boolean | has the process errored                                           |
| `data`         | (optional) object  | object with additional data                                       |


# ServiceTasks

## `onifyApiRequest(options[, callback])`

Make an Onify API request with the user currently running the flow.

Arguments:
- `options`: a string with the requested URI, or an object with:
  - `url`: (required) the request URL, accepts relative api URL e.g. `/my/settings` without api version
  - `query`: (optional) optional object containing search parameters. Will be stringified using node.js built in function `querystring.stringify`
  - `method`: (optional) the request HTTP method (e.g. `POST`). Defaults to `GET`
  - `headers`: (optional) an object with optional request headers where each key is the header name and the value is the header content
    - `authorization`: (optional) override authorization
  - `throwHttpErrors`: (optional) boolean indicating that non 200 responses will throw an error, defaults to `true`
  - `payload`: (optional) a string, buffer or object containing the request payload

Returns:
  - `statusCode`: the HTTP status code
  - `statusMessage`: the HTTP status message
  - `headers`: an object containing the headers set
  - `payload`: the response raw payload
  - `body`: response body, parsed as JSON

## `onifyElevatedApiRequest(options[, callback])`

Same as `onifyApiRequest` but with admin privilegies.

## `httpRequest(options[, callback])`

Make an external HTTP request. The request library used is [npm module got](https://github.com/sindresorhus/got).

Arguments:
- `options`: required object passed to [got](https://github.com/sindresorhus/got):
  - `url`: (required) the request URL
  - `query`: (optional) optional object containing search parameters. Will be stringified using node.js built in function `querystring.stringify`
  - `method`: (optional) the request HTTP method (e.g. `POST`). Defaults to `GET`
  - `headers`: (optional) an object with optional request headers where each key is the header name and the value is the header content
    - `authorization`: (optional) override authorization
  - `throwHttpErrors`: (optional) boolean indicating that non 200 responses will throw an error, defaults to `true`
  - `payload`: (optional) a string, buffer or object containing the request payload

Returns:
  - `statusCode`: the HTTP status code
  - `statusMessage`: the HTTP status message
  - `headers`: an object containing the headers set
  - `body`: response body

# JavaScript

Onify flow supports javascript in a ScriptTask, as SequenceFlow condition, or in Input/Output parameters.

> NB! The flow execution stalls until [next](#nexterr-result) has to be called for the flow to continue.

## Global context

Since script will be sandboxed they have some specific global properties and functions that can be addressed directly or under `this`.

When in doubt on where to find your information insert this script:

```js
console.log(this);
next();
```

### `fields`

Object with information regarding the message that executed activity.

### `content`

Object with information of the current running activity.

Here you can find input and/or output that was defined for the activity execution.

### `properties`

Object with properties of the message that executed activity.

### `environment`

Flow execution [environment](https://github.com/paed01/bpmn-elements/blob/master/docs/Environment.md).


### `contextName`

Name of running flow.

### `next(err, result)`

Must be called when script is completed.

### `Buffer.from(...args)`

Node.js function [Buffer.from](https://nodejs.org/dist/latest-v14.x/docs/api/buffer.html#buffer_buffer_from_buffer_alloc_and_buffer_allocunsafe).

Usefull for encoding and decoding Base64.

#### Encode as base64

Example:
```js
Buffer.from('Hello world').toString('base64');
```

#### Decode base64

Example:
```js
Buffer.from('SGVsbG8gd29ybGQ=', 'base64').toString();
```

### `console.log(...args)`

Basic javascript `console.log('Hello world')`. Write something on stdout. Will end up in console or in a container log.

### `decrypt(encryptedText, encoding = 'hex')`

Decrypt an encrypted text with defined Onify client secret.

### `encrypt(text, encoding = 'hex')`

Encrypt text with defined Onify client secret.

### `jwt.sign(...)`

Create a signed JWT using [npm module jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) sign function.

### `jwt.verify(...)`

Varify a signed JWT using [npm module jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) verify function.
