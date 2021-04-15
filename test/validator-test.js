const {promises: fs} = require('fs');
const {expect} = require('chai');

const FlowValidator = require('..');

describe('Flow validator', () => {
  describe('validate happy trail', () => {
    let source, validator;
    before(async () => {
      source = await fs.readFile('./test/resources/happy-trail.bpmn');
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

    it('when overridden with eslint no-console rule lint errors are returned', async () => {
      const {linting} = await validator.validate({
        rules: {
          'no-console': 2,
        }
      });
      expect(linting, linting).to.have.length.above(0);
      expect(linting[0]).to.contain('no-console');
    });
  });

  describe('BPMN moddle warnings', () => {
    it('warnings are detected', async () => {
      const source = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions id="command-definition" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
        targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="my-process" isExecutable="true">
          <sequenceFlow targetRef="task" />
        </process>
      </definitions>`;

      const {warnings} = await FlowValidator(source).validate();
      expect(warnings).to.have.length.above(0);
      expect(warnings[0]).to.have.property('message').that.match(/unresolved reference/i);
    });
  });
});
