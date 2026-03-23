import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidTemplateTokenPath,
  renderTemplatedValue,
  renderTemplateString,
  validateTemplateString,
} from "@/lib/server/actions/templating";

test("validateTemplateString rejects malformed dotted paths and unsafe path segments", () => {
  assert.equal(validateTemplateString("{{ payload.ticket..id }}").length, 1);
  assert.equal(validateTemplateString("{{ payload.ticket. }}").length, 1);
  assert.equal(validateTemplateString("{{ payload.__proto__.secret }}").length, 1);
  assert.equal(validateTemplateString("{{ context.constructor.value }}").length, 1);
});

test("isValidTemplateTokenPath accepts safe segments and rejects empty or prototype segments", () => {
  assert.equal(isValidTemplateTokenPath("ticket.items.0.id"), true);
  assert.equal(isValidTemplateTokenPath("request-id"), true);
  assert.equal(isValidTemplateTokenPath(""), false);
  assert.equal(isValidTemplateTokenPath("ticket..id"), false);
  assert.equal(isValidTemplateTokenPath("__proto__.id"), false);
});

test("renderTemplateString resolves nested objects and array indices", () => {
  const context = {
    payload: {
      ticket: {
        id: "T-100",
      },
      items: [{ name: "vip" }, { name: "standard" }],
    },
    context: {
      sourceLabel: "webhook",
      trace: {
        ids: ["trace-1", "trace-2"],
      },
    } as never,
  };

  assert.equal(
    renderTemplateString({
      template: "{{ payload.ticket.id }}",
      context,
    }),
    "T-100",
  );
  assert.equal(
    renderTemplateString({
      template: "{{ payload.items.0.name }}",
      context,
    }),
    "vip",
  );
  assert.equal(
    renderTemplateString({
      template: "{{ context.trace.ids.1 }}",
      context,
    }),
    "trace-2",
  );
});

test("renderTemplateString preserves native values for exact tokens and stringifies mixed tokens", () => {
  const context = {
    payload: {
      count: 4,
      active: true,
      details: {
        plan: "gold",
      },
    },
    context: {
      sourceLabel: "manual",
    } as never,
  };

  assert.equal(
    renderTemplateString({
      template: "{{ payload.count }}",
      context,
    }),
    4,
  );
  assert.equal(
    renderTemplateString({
      template: "{{ payload.active }}",
      context,
    }),
    true,
  );
  assert.deepEqual(
    renderTemplateString({
      template: "{{ payload.details }}",
      context,
    }),
    { plan: "gold" },
  );
  assert.equal(
    renderTemplateString({
      template: "plan={{ payload.details }} active={{ payload.active }}",
      context,
    }),
    'plan={"plan":"gold"} active=true',
  );
});

test("renderTemplatedValue recurses through objects and arrays", () => {
  const rendered = renderTemplatedValue(
    {
      url: "https://example.com/{{ payload.ticket.id }}",
      headers: {
        "X-Source": "{{ context.sourceLabel }}",
      },
      items: ["{{ payload.ticket.id }}", "{{ payload.tags.1 }}"],
    },
    {
      payload: {
        ticket: {
          id: "T-100",
        },
        tags: ["priority", "vip"],
      },
      context: {
        sourceLabel: "internal_event",
      } as never,
    },
  );

  assert.deepEqual(rendered, {
    url: "https://example.com/T-100",
    headers: {
      "X-Source": "internal_event",
    },
    items: ["T-100", "vip"],
  });
});
