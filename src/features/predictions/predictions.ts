import { PRIMARY_BRAND } from '@/config/brand';
import { predictionRepository } from '@/services/prediction-repository';
import type { PredictionFactor } from '../../../shared/prediction-engine';
import './predictions.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navLink(label: string, href: string): HTMLAnchorElement {
  const node = el('a', undefined, label);
  node.href = href;
  return node;
}

function factorList(title: string, factors: readonly PredictionFactor[]): HTMLElement {
  const section = el('section');
  section.append(el('strong', undefined, title));
  const list = el('ul');
  if (factors.length === 0) list.append(el('li', undefined, '无可显示分项'));
  for (const factor of factors) list.append(el('li', undefined, `${factor.feature_id}: ${factor.observed_value} → ${factor.contribution >= 0 ? '+' : ''}${factor.contribution}`));
  section.append(list);
  return section;
}

export function initPredictionsWorkspace(rootId = 'app'): void {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`Predictions root #${rootId} was not found`);
  const page = el('main', 'predictions');
  const header = el('header', 'predictions__header');
  const title = el('div');
  title.append(
    el('p', 'predictions__eyebrow', PRIMARY_BRAND),
    el('h1', undefined, 'AI 推演、到期评估与历史表现'),
    el('p', undefined, 'LOCAL_BASELINE_V1 是确定性、未校准的本地基线；不会调用随机数，也不会把模型关系写入事实表。'),
  );
  const nav = el('nav', 'predictions__nav');
  nav.append(navLink('全球趋势', '/trends'), navLink('影响图谱', '/impact-graph'), navLink('Provider 运维', '/provider-operations'), navLink('返回地球', '/'));
  header.append(title, nav);

  const content = el('div', 'predictions__content');
  const warning = el('section', 'predictions__panel predictions__warning');
  warning.append(el('strong', undefined, '固定警示'), el('p', undefined, 'AI/模型推演，不是事实、投资建议或已证明因果；概率为未校准的本地基线估计。'));
  const performancePanel = el('section', 'predictions__panel');
  performancePanel.append(el('h2', undefined, '历史表现'));
  const performanceGrid = el('div', 'predictions__metrics');
  performancePanel.append(performanceGrid);
  const historyPanel = el('section', 'predictions__panel');
  historyPanel.append(el('h2', undefined, '全部推演历史'));
  const historyList = el('div', 'predictions__list');
  historyPanel.append(historyList);
  content.append(warning, performancePanel, historyPanel);
  page.append(header, content);
  root.replaceChildren(page);

  void Promise.all([predictionRepository.history(), predictionRepository.performance()]).then(([history, performance]) => {
    const metrics: readonly [string, string][] = [
      ['已评估', String(performance.evaluated_count)],
      ['失效但保留', String(performance.invalidated_count)],
      ['平均 Brier', performance.mean_brier_score === null ? '尚无到期样本' : performance.mean_brier_score.toFixed(4)],
      ['分类准确率', performance.classification_accuracy === null ? '尚无到期样本' : `${(performance.classification_accuracy * 100).toFixed(1)}%`],
    ];
    performanceGrid.replaceChildren(...metrics.map(([label, value]) => {
      const metric = el('div', 'predictions__metric');
      metric.append(el('span', undefined, label), el('strong', undefined, value));
      return metric;
    }));
    if (history.length === 0) {
      historyList.append(el('p', undefined, '当前没有生产推演。输入不足时系统会保存 INSUFFICIENT_DATA，而不是生成虚假概率。'));
      return;
    }
    for (const prediction of history) {
      const card = el('article', 'predictions__card');
      card.dataset.status = prediction.status;
      card.append(
        el('span', 'predictions__badge', prediction.status),
        el('h3', undefined, `${prediction.target_kind} · ${prediction.target_id}`),
        el('p', undefined, prediction.probability_estimate === null ? '概率：不可计算' : `未来 ${prediction.horizon_minutes} 分钟估计概率 ${(prediction.probability_estimate * 100).toFixed(1)}%`),
      );
      const facts = el('div', 'predictions__facts');
      facts.append(
        el('span', undefined, `数据截止 ${prediction.data_cutoff_at}`),
        el('span', undefined, `生成 ${prediction.generated_at}`),
        el('span', undefined, `到期 ${prediction.expires_at}`),
        el('span', undefined, `模型 ${prediction.model_version}`),
        el('span', undefined, `来源证据 ${prediction.source_evidence_ids.length} 条`),
      );
      card.append(facts, el('p', undefined, prediction.outcome_definition));
      if (prediction.status === 'INSUFFICIENT_DATA') {
        const list = el('ul');
        for (const reason of prediction.insufficiency_reasons) list.append(el('li', undefined, reason));
        card.append(list);
      } else {
        const factors = el('div', 'predictions__factors');
        factors.append(factorList('支持因素', prediction.supporting_factors), factorList('反向因素', prediction.counter_factors));
        card.append(factors);
      }
      card.append(el('p', 'predictions__disclaimer', prediction.disclaimer));
      historyList.append(card);
    }
  }).catch((error) => {
    historyList.replaceChildren(el('p', undefined, `预测仓库读取失败：${error instanceof Error ? error.message : 'unknown error'}`));
  });
}
