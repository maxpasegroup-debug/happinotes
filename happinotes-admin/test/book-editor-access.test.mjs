import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const flush = () => new Promise(resolve => setImmediate(resolve));
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
function mount(initial) {
  const slots = [], effects = [], uploads = [];
  let cursor = 0, stored = initial;
  const hooks = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useMemo: fn => fn(),
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((value, index) => value !== slots[i][index])) effects.push(fn); slots[i] = deps; },
  };
  const modules = {
    react: hooks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/image': { default: 'Image' }, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@heroui/react': { Card: 'Card', Switch: 'Switch', addToast() {} },
    '@/components/admin/LanguagePicker': { default: 'LanguagePicker' },
    '@/components/admin/ConfirmationProvider': { useAdminConfirmation: () => async () => true },
    '@/components/admin/ui': Object.fromEntries(['AdminButton', 'AdminCheckbox', 'AdminInput', 'AdminTextarea', 'AdminProgress', 'AdminSelect'].map(name => [name, name])),
    '@/lib/media-validation': {},
    '@/lib/api': {
      apiRequest: async () => ({ contents: [stored] }),
      uploadMultipart: async (_url, body) => {
        uploads.push(body);
        stored = { ...stored, type: body.get('type'), lessons: JSON.parse(body.get('lessons')) };
      },
    },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('components/admin/BookEditor.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, FormData, window: { localStorage: { getItem: () => 'test' }, setTimeout() {} }, require: name => {
    assert.ok(name in modules, name); return modules[name];
  } });
  const render = () => { cursor = 0; const tree = exports.default({ contentId: 'book' }); effects.splice(0).forEach(fn => fn()); return nodes(tree); };
  return { render, uploads, stored: () => stored };
}
const fixture = { _id: 'book', title: 'Book', language: 'English', type: 'free', contentType: 'lifebook', status: 'live', thumbnailUrl: '/cover.jpg', lessons: [
  { title: 'First', order: 0, mediaUrl: '/one.mp3', accessType: 'free', thumbnailUrl: '/one.jpg' },
  { title: 'Second', order: 1, mediaUrl: '/two.mp3', accessType: 'free', thumbnailUrl: '/two.jpg' },
] };
const lessons = tree => tree.filter(node => node.type?.name === 'LessonTableRow');
function toggleLesson(editor, index, paid) {
  const card = lessons(editor.render())[index];
  // Exercise the actual rendered row Switch, not a substitute update function.
  const switchNode = nodes(card.type(card.props)).find(node => node.type === 'Switch');
  switchNode.props.onValueChange(paid);
}
async function save(editor) {
  editor.render().find(node => node.type === 'AdminButton' && node.props.children === 'Save changes').props.onClick();
  await flush();
}

test('only the toggled lesson becomes Premium, including after saving and reopening', async () => {
  const editor = mount(fixture); editor.render(); await flush();
  toggleLesson(editor, 0, true);
  assert.deepEqual(lessons(editor.render()).map(node => node.props.lesson.accessType), ['premium', 'free']);
  assert.ok(editor.render().some(node => [node.props?.children].flat().includes('Free + Premium')));
  await save(editor);
  assert.equal(editor.uploads[0].get('type'), 'free', 'one paid lesson must not promote the whole book');
  assert.deepEqual(JSON.parse(editor.uploads[0].get('lessons')).map(l => [l.accessType, l.mediaUrl, l.thumbnailUrl, l.order]), [
    ['premium', '/one.mp3', '/one.jpg', 0], ['free', '/two.mp3', '/two.jpg', 1],
  ]);
  const reopened = mount(editor.stored()); reopened.render(); await flush();
  assert.deepEqual(lessons(reopened.render()).map(node => node.props.lesson.accessType), ['premium', 'free']);
  toggleLesson(reopened, 0, false);
  await save(reopened);
  assert.deepEqual(JSON.parse(reopened.uploads[0].get('lessons')).map(l => l.accessType), ['free', 'free']);
});

test('new lessons start Free even when all existing lessons are Premium', async () => {
  const editor = mount(fixture); editor.render(); await flush();
  toggleLesson(editor, 0, true);
  toggleLesson(editor, 1, true);
  await save(editor);
  assert.equal(editor.uploads[0].get('type'), 'premium');
  await editor.render().find(node => node.type === 'AdminButton' && node.props.children === '+ Add lesson').props.onClick();
  assert.deepEqual(lessons(editor.render()).map(node => [node.props.index, node.props.lesson.accessType]), [[2, 'free'], [1, 'premium'], [0, 'premium']]);
});

test('a legacy Premium book can make a single lesson Free without unlocking its siblings', async () => {
  const editor = mount({ ...fixture, type: 'premium', lessons: fixture.lessons.map(lesson => ({ ...lesson, accessType: undefined })) });
  editor.render(); await flush();
  toggleLesson(editor, 1, false);
  await save(editor);
  assert.deepEqual(JSON.parse(editor.uploads[0].get('lessons')).map(l => l.accessType), ['premium', 'free']);
});


test('global Free/Paid applies to all lessons while later individual changes stay independent', async () => {
  const editor = mount(fixture); editor.render(); await flush();
  const globalToggle = () => editor.render().find(node => node.props?.['aria-label'] === 'Paid access for all lessons');
  globalToggle().props.onValueChange(true);
  assert.deepEqual(lessons(editor.render()).map(node => node.props.lesson.accessType), ['premium', 'premium']);
  await save(editor);
  assert.equal(editor.uploads[0].get('type'), 'premium');
  toggleLesson(editor, 1, false);
  assert.deepEqual(lessons(editor.render()).map(node => node.props.lesson.accessType), ['premium', 'free']);
  await save(editor);
  assert.equal(editor.uploads[1].get('type'), 'free');
  editor.render().find(node => node.props?.['aria-label'] === 'Set all lessons Free').props.onClick();
  assert.deepEqual(lessons(editor.render()).map(node => node.props.lesson.accessType), ['free', 'free']);
  await save(editor);
  assert.deepEqual(JSON.parse(editor.uploads[2].get('lessons')).map(l => [l.accessType, l.thumbnailUrl, l.mediaUrl]), [
    ['free', '/one.jpg', '/one.mp3'], ['free', '/two.jpg', '/two.mp3'],
  ]);
});


const setControl = (editor, label, value) => editor.render().find(node => node.props?.['aria-label'] === label).props.onChange({ target: { value } });
const browseFixture = { ...fixture, lessons: [
  { ...fixture.lessons[0], title: 'Morning', createdAt: '2026-11-03T10:00:00.000Z' },
  { ...fixture.lessons[1], title: 'Evening', accessType: 'premium', createdAt: '2026-11-01T10:00:00.000Z' },
  { ...fixture.lessons[0], title: 'Night', order: 2, mediaUrl: '/three.mp3', createdAt: '2026-11-02T10:00:00.000Z' },
] };

test('search by exact part or name combines with Free/Paid filtering and reset', async () => {
  const editor = mount(browseFixture); editor.render(); await flush();
  setControl(editor, 'Search lessons', 'part 02');
  assert.deepEqual(lessons(editor.render()).map(n => n.props.index), [1]);
  setControl(editor, 'Filter lesson access', 'free');
  assert.equal(lessons(editor.render()).length, 0);
  assert.ok(editor.render().some(n => n.props?.children === 'No matching lessons'));
  setControl(editor, 'Filter lesson access', 'premium');
  assert.deepEqual(lessons(editor.render()).map(n => n.props.index), [1]);
  setControl(editor, 'Search lessons', 'EVEN');
  assert.deepEqual(lessons(editor.render()).map(n => n.props.index), [1]);
  editor.render().find(n => n.props?.children === 'Reset filters').props.onClick();
  assert.deepEqual(lessons(editor.render()).map(n => n.props.index), [0, 1, 2]);
});

test('newest/oldest sorting uses added dates, edits the actual part and saves every hidden lesson in original order', async () => {
  const editor = mount(browseFixture); editor.render(); await flush();
  setControl(editor, 'Sort lessons', 'newest');
  assert.deepEqual(lessons(editor.render()).map(n => n.props.index), [0, 2, 1]);
  setControl(editor, 'Sort lessons', 'oldest');
  assert.deepEqual(lessons(editor.render()).map(n => n.props.index), [1, 2, 0]);
  setControl(editor, 'Search lessons', 'Evening');
  toggleLesson(editor, 0, false); // First visible card is actually part 2.
  await save(editor);
  const saved = JSON.parse(editor.uploads[0].get('lessons'));
  assert.deepEqual(saved.map(l => [l.title, l.accessType, l.order]), [['Morning', 'free', 0], ['Evening', 'free', 1], ['Night', 'free', 2]]);
  assert.deepEqual(saved.map(l => l.createdAt), browseFixture.lessons.map(l => l.createdAt));
});

test('adding clears restrictive filters and reveals the new Free lesson first', async () => {
  const editor = mount(browseFixture); editor.render(); await flush();
  setControl(editor, 'Search lessons', 'Nothing');
  setControl(editor, 'Filter lesson access', 'premium');
  await editor.render().find(n => n.type === 'AdminButton' && n.props.children === '+ Add lesson').props.onClick();
  assert.equal(lessons(editor.render()).length, 4);
  const first = lessons(editor.render())[0].props;
  assert.equal(first.index, 3);
  assert.equal(first.lesson.accessType, 'free');
  assert.ok(Number.isFinite(Date.parse(first.lesson.createdAt)));
});

test('validation finds invalid hidden parts and exposes their errors instead of saving a filtered subset', async () => {
  const editor = mount(browseFixture);
  editor.render(); await flush();
  lessons(editor.render())[2].props.onChange({ title: '' });
  setControl(editor, 'Search lessons', 'Part 1');
  await save(editor);
  assert.equal(editor.uploads.length, 0);
  assert.deepEqual(lessons(editor.render()).map(n => n.props.index), [2]);
});


test('lesson table starts collapsed, expands one editor at a time, and retains edits when closed', async () => {
  const editor = mount(fixture); editor.render(); await flush();
  assert.ok(lessons(editor.render()).every(row => row.props.expanded === false));
  lessons(editor.render())[0].props.onExpand();
  let rows = lessons(editor.render());
  assert.equal(rows[0].props.expanded, true);
  const expandedContent = nodes(rows[0].type(rows[0].props)).find(node => node.type?.name === 'LessonCard');
  assert.ok(expandedContent, 'full editor mounts only for the expanded row');
  expandedContent.props.onChange({ title: 'Edited in details' });
  lessons(editor.render())[1].props.onExpand();
  rows = lessons(editor.render());
  assert.deepEqual(rows.map(row => row.props.expanded), [false, true]);
  assert.equal(rows[0].props.lesson.title, 'Edited in details');
  rows[1].props.onExpand();
  assert.ok(lessons(editor.render()).every(row => !row.props.expanded));
  await save(editor);
  assert.equal(JSON.parse(editor.uploads[0].get('lessons'))[0].title, 'Edited in details');
});

test('an expanded lesson remains attached to its identity when sorting or reordering', async () => {
  const editor = mount(browseFixture); editor.render(); await flush();
  lessons(editor.render())[1].props.onExpand();
  setControl(editor, 'Sort lessons', 'newest');
  let expanded = lessons(editor.render()).find(row => row.props.expanded);
  assert.equal(expanded.props.lesson.title, 'Evening');
  expanded.props.onMove(-1);
  expanded = lessons(editor.render()).find(row => row.props.expanded);
  assert.equal(expanded.props.lesson.title, 'Evening');
  assert.equal(expanded.props.index, 0);
});
