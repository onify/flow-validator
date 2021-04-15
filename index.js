const BpmnElements = require('bpmn-elements');
const BpmnModdle = require('bpmn-moddle');
const camundaModdle = require('camunda-bpmn-moddle/resources/camunda');
const {default: Serializer, TypeResolver} = require('moddle-context-serializer');
const {ESLint} = require('eslint');

module.exports = function FlowValidator(source) {
  const bpmnModdle = new BpmnModdle({
    camunda: camundaModdle,
  });

  let moddleContextCall;

  return {
    validate,
    lint,
  };

  async function validate({rules} = {}) {
    const moddleContext = await getModdleContext();
    const linting = await lint({rules});

    return {
      moddleContext,
      warnings: moddleContext.warnings && moddleContext.warnings.slice(),
      linting,
    };
  }

  async function lint({rules} = {}) {
    const eslint = new ESLint({
      overrideConfig: {
        globals: {
          Buffer: false,
          console: false,
          content: false,
          contextName: false,
          decrypt: false,
          encrypt: false,
          environment: false,
          fields: false,
          jwt: false,
          next: false,
          properties: false,
        },
        rules: {
          'eol-last': 0,
          'indent': 0,
          'no-console': 1,
          ...rules,
        },
      },
    });

    const moddleContext = await getModdleContext();
    const typeResolver = TypeResolver(BpmnElements);
    const serialized = Serializer(moddleContext, typeResolver, extendoFn);

    const scripts = serialized.getScripts();

    const linting = [];
    while (scripts.length) {
      const {script, name} = scripts.pop();
      const [res]  = await eslint.lintText(script.body, {filePath: name});
      const formatted = formatLintMessages(name, res.messages);
      if (formatted) {
        linting.push(formatted);
      }
    }

    return linting;
  }

  function getModdleContext() {
    if (moddleContextCall) return moddleContextCall;
    moddleContextCall = bpmnModdle.fromXML(source.toString());
    return moddleContextCall;
  }

  function formatLintMessages(name, messages) {
    return messages.reduce((result, {ruleId, message, severity, line, column}) => {
      if (severity < 2) return result;
      if (!result) result = '\n' + name;
      result += `\n  ${line}:${column} ${message} (${ruleId})`;
      return result;
    }, undefined);
  }
};

function extendoFn(behaviour, context) {
  if (behaviour.$type === 'bpmn:StartEvent' && behaviour.eventDefinitions) {
    const timer = behaviour.eventDefinitions.find(({type, behaviour: edBehaviour}) => edBehaviour && type === 'bpmn:TimerEventDefinition');
    if (timer && timer.behaviour.timeCycle) Object.assign(behaviour, {scheduledStart: timer.behaviour.timeCycle});
  }

  if (!behaviour.extensionElements || !Array.isArray(behaviour.extensionElements.values)) return;

  const inputOutput = behaviour.extensionElements.values.find(({$type}) => $type === 'camunda:InputOutput');
  const connector = behaviour.extensionElements.values.find(({$type}) => $type === 'camunda:Connector');

  if (inputOutput) registerIOScripts(inputOutput.$type, inputOutput);
  if (connector) registerIOScripts(connector.$type, connector.inputOutput);

  function registerIOScripts(type, ioBehaiour) {
    if (!ioBehaiour) return;
    const {inputParameters = [], outputParameters = []} = ioBehaiour;
    inputParameters.concat(outputParameters).forEach(({$type: ioType, name, definition}) => {
      if (!definition) return;
      if (definition.$type === 'camunda:Script') {
        const filename = `${behaviour.id}/${type}/${ioType}/${name}`;

        context.addScript(filename, {
          parent: {id: behaviour.id, type: behaviour.type},
          id: filename,
          scriptFormat: definition.scriptFormat,
          ...(definition.value ? {body: definition.value}: undefined),
          ...(definition.resource ? {resource: definition.resource}: undefined),
        });
      }
    });
  }
}
