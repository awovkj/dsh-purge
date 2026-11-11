import React from 'react';

const h = React.createElement;
const rules = value => String(value || '').split(/[\r\n,]+/).map(item => item.trim()).filter(Boolean);
const field = (label, value, set, placeholder, props = {}) => h('label', { style: { display: 'grid', gap: 4, marginBottom: 8 } },
  label, h('input', { className: 'rt-input', value, placeholder, ...props, onChange: event => set(event.target.value) }));

// Identity, rather than an engagement ID alone, also fences A -> B -> A and
// unmount/remount. Layout cleanup invalidates callbacks before the next paint.
function useRequestGeneration(engagement, api) {
  const owner = React.useRef(null);
  const generation = React.useRef(0);
  const captured = React.useMemo(() => ({ engagement, api, active: false, generation: 0, readSequence: 0 }), [engagement, api]);
  React.useLayoutEffect(() => {
    captured.generation = ++generation.current;
    captured.readSequence = 0;
    captured.active = true;
    owner.current = captured;
    return () => { captured.active = false; };
  }, [captured]);
  return { owner, captured };
}

const isCurrent = (owner, captured, generation = captured?.generation) => captured?.active === true
  && owner.current === captured && captured.generation === generation;
const failureText = failure => String(failure?.message || failure || '操作未完成');

export function AssessmentTab({ engagement, api }) {
  const [status, setStatus] = React.useState(null);
  const [target, setTarget] = React.useState('');
  const [scope, setScope] = React.useState('');
  const [model, setModel] = React.useState('v1');
  const [sourceOffset, setSourceOffset] = React.useState(0);
  const [reviewOffset, setReviewOffset] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [resultOperation, setResultOperation] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = React.useRef(null);
  React.useLayoutEffect(() => {
    flight.current = null;
    setStatus(null); setTarget(''); setScope(''); setModel('v1');
    setSourceOffset(0); setReviewOffset(0); setResult(null); setResultOperation(''); setError(''); setBusy(false);
  }, [captured]);

  const acceptStatus = value => {
    setStatus(value);
    const urls = (value.context?.scope || value.assessment_policy?.scope || []).filter(rule => /^https?:\/\//i.test(rule));
    setTarget(value.context?.target || urls[0] || ''); setScope(urls.join('\n'));
    setModel(value.context?.model === 'v2' ? 'v2' : 'v1');
    if (value?.ok === false) setError(failureText(value.error));
  };

  const refresh = async (captured, generation = captured.generation) => {
    if (!isCurrent(owner, captured, generation)) return;
    const sequence = ++captured.readSequence;
    try {
      const value = await captured.api({ op: 'assessmentStatus', ...(captured.engagement ? { engagement: captured.engagement } : {}) });
      if (!isCurrent(owner, captured, generation) || sequence !== captured.readSequence) return value;
      acceptStatus(value);
      return value;
    } catch (failure) {
      if (isCurrent(owner, captured, generation) && sequence === captured.readSequence) throw failure;
    }
  };
  React.useEffect(() => {
    const generation = captured.generation;
    refresh(captured, generation).catch(failure => { if (isCurrent(owner, captured, generation)) setError(failureText(failure)); });
  }, [captured]);

  const run = async request => {
    if (!isCurrent(owner, captured) || flight.current) return;
    const generation = captured.generation;
    const requestFlight = { captured };
    flight.current = requestFlight;
    const statusSequence = request.op === 'assessmentStatus' ? ++captured.readSequence : null;
    setBusy(true); setError('');
    try {
      const value = await captured.api({ ...request, ...(captured.engagement ? { engagement: captured.engagement } : {}) });
      if (!isCurrent(owner, captured, generation)) return value;
      if (value?.ok === false) throw new Error(value.error || '操作未完成');
      setResult(value);
      setResultOperation(request.op);
      if (request.op === 'assessmentStatus' && statusSequence === captured.readSequence) acceptStatus(value);
      if (request.op === 'assessmentStart') await refresh(captured, generation);
      return value;
    } catch (failure) { if (isCurrent(owner, captured, generation)) setError(failureText(failure)); }
    finally {
      if (flight.current === requestFlight) {
        flight.current = null;
        if (isCurrent(owner, captured, generation)) setBusy(false);
      }
    }
  };
  const button = (label, request, disabled = false) => h('button', { className: 'rt-btn', disabled: busy || disabled,
    'data-assessment-operation': request.op, 'data-assessment-action': request.action || '',
    'data-assessment-verify': typeof request.verify === 'boolean' ? String(request.verify) : '',
    onClick: () => run(request) }, label);
  const ready = status?.context?.ready === true;
  const resultText = result ? JSON.stringify(result, (key, value) => ['project_id', 'packagePath'].includes(key) ? undefined : value, 2) : '';
  const resultPageKind = result?.page_kind || (resultOperation === 'assessmentImport' ? 'source_candidates'
    : resultOperation === 'assessmentReview' ? 'assessment_candidates' : '');
  const canPageResult = ['source_candidates', 'assessment_candidates'].includes(resultPageKind) && result?.next_offset != null;
  const nextResultPage = () => {
    if (!isCurrent(owner, captured) || !canPageResult) return;
    if (resultPageKind === 'source_candidates') setSourceOffset(result.next_offset);
    else setReviewOffset(result.next_offset);
  };
  return h('div', { className: 'rt-pane' },
    h('div', { className: 'rt-card' }, h('h4', null, '内置证据评估'),
      h('p', null, '评估核心随项目提供，直接使用当前靶标的范围和台账。候选需通过真实对照与可复核证据确认。'),
      h('div', { className: 'rt-tag', 'data-assessment-engine': 'embedded' }, status?.engine?.embedded
        ? `项目内置评估核心 · ${status.engine.version || ''}` : '正在检查内置评估核心'),
      engagement ? h(React.Fragment, null,
        h('p', { 'data-assessment-context': ready ? 'ready' : 'pending' }, ready
          ? `当前靶标评估已准备 · ${status.context.target || ''}`
          : '当前靶标尚需明确 HTTP 目标与范围。'),
        !ready ? h(React.Fragment, null,
          field('目标 URL', target, setTarget, 'https://example.test/app'),
          h('label', { style: { display: 'grid', gap: 4, marginBottom: 8 } }, '明确 URL 范围（每行一项）',
            h('textarea', { className: 'rt-textarea', rows: 3, value: scope, onChange: event => setScope(event.target.value) })),
          h('label', { style: { display: 'grid', gap: 4, marginBottom: 8 } }, '评估模型',
            h('select', { className: 'rt-input', value: model, onChange: event => setModel(event.target.value), 'data-assessment-model': true },
              h('option', { value: 'v1' }, '证据与测试义务'), h('option', { value: 'v2' }, '假设与测试配方'))),
          button('准备当前靶标评估', { op: 'assessmentStart', target, scope: rules(scope), assessmentModel: model }, !target || !rules(scope).length)) :
          h(React.Fragment, null,
            button('刷新评估状态', { op: 'assessmentStatus' }),
            status.context.workspace ? h('details', null, h('summary', null, '台账位置'), h('p', { className: 'rt-mono' }, status.context.workspace)) : null),
        h('hr'),
        field('来源候选页偏移', String(sourceOffset), value => setSourceOffset(Number(value)), '0', { 'data-assessment-cursor': 'source_candidates' }),
        field('评估复核页偏移', String(reviewOffset), value => setReviewOffset(Number(value)), '0', { 'data-assessment-cursor': 'assessment_candidates' }),
        h('p', null, '来源分页用于纳入候选；复核分页检查本靶标全部已纳入候选。两个页偏移分别记录。'),
        h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          button('纳入本页候选', { op: 'assessmentImport', offset: sourceOffset, limit: 50 }, !ready),
          button('查看评估台账', { op: 'assessmentRun', action: 'project.status', input: { limit: 3 } }, !ready),
          button('复核已有证据', { op: 'assessmentReview', verify: false, offset: reviewOffset, limit: 50 }, !ready),
          button('确认已证明发现', { op: 'assessmentReview', verify: true, offset: reviewOffset, limit: 50 }, !ready))) :
        h('p', null, '先创建靶标，评估核心将使用该靶标的内部上下文。'),
      error ? h('div', { className: 'rt-err' }, error) : null,
      result ? h('details', { open: true }, h('summary', null, '本次结果'),
        canPageResult ? h('button', { className: 'rt-btn', disabled: busy, 'data-assessment-next': resultPageKind, onClick: nextResultPage },
          resultPageKind === 'source_candidates' ? '选择下一来源候选页' : '选择下一评估复核页') : null,
        h('pre', { className: 'rt-mono', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 360, overflow: 'auto' } },
          resultText.slice(0, 12000)),
        resultText.length > 12000 ? h('p', null, '当前结果仅显示前 12,000 个字符，请使用小页完成复核。') : null) : null));
}

export const AwaEvidenceTab = AssessmentTab;

export function SrcDiscoveryReport({ engagement, api }) {
  const [report, setReport] = React.useState(null);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const { owner, captured } = useRequestGeneration(engagement, api);
  const flight = React.useRef(null);
  React.useLayoutEffect(() => {
    flight.current = null;
    setReport(null); setError(''); setSaving(false);
  }, [captured]);
  React.useEffect(() => {
    const generation = captured.generation;
    const sequence = ++captured.readSequence;
    const load = async () => {
      if (!isCurrent(owner, captured, generation)) return;
      try {
        const value = await captured.api({ op: 'srcReport', engagement: captured.engagement, save: false });
        if (!isCurrent(owner, captured, generation) || sequence !== captured.readSequence) return;
        if (value?.ok === false) setError(value.error || '报告读取失败'); else setReport(value);
      } catch (failure) {
        if (isCurrent(owner, captured, generation) && sequence === captured.readSequence) setError(failureText(failure));
      }
    };
    load();
  }, [captured]);
  const save = async () => {
    if (!isCurrent(owner, captured) || flight.current) return;
    const generation = captured.generation;
    const requestFlight = { captured };
    flight.current = requestFlight;
    const sequence = ++captured.readSequence;
    setSaving(true); setError('');
    try {
      const value = await captured.api({ op: 'srcReport', engagement: captured.engagement, save: true });
      if (!isCurrent(owner, captured, generation) || sequence !== captured.readSequence) return value;
      if (value?.ok === false) setError(value.error || '报告保存失败'); else setReport(value);
      return value;
    } catch (failure) { if (isCurrent(owner, captured, generation) && sequence === captured.readSequence) setError(failureText(failure)); }
    finally {
      if (flight.current === requestFlight) {
        flight.current = null;
        if (isCurrent(owner, captured, generation)) setSaving(false);
      }
    }
  };
  return h('div', { className: 'rt-pane' }, h('div', { className: 'rt-card' }, h('h4', null, 'SRC 漏洞发现报告'),
    h('p', null, '报告保留直接证据、停止原因和待核实项。发现停止与整体覆盖完成分别记录。'),
    h('button', { className: 'rt-btn', disabled: saving, 'data-src-action': 'save', onClick: save }, '保存发现报告'),
    report?.path ? h('p', { className: 'rt-mono' }, report.path) : null,
    error ? h('div', { className: 'rt-err' }, error) : null,
    report ? h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, report.markdown) : null));
}
