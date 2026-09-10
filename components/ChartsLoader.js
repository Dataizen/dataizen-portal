'use client';
// Graphiques du portail (ECharts auto-hébergé, chargé à la demande).
// Cible : <div class="dtz-graphique" data-config="ID"> posé par la directive
// [[graphique:ID]]. Les données/séries sont calculées côté serveur (/api/graphique).
// Un graphique de portée « territoire » est RÉACTIF : il s'abonne au bus de
// sélection et se recompose quand l'utilisateur clique un territoire au-dessus.
// Accessibilité (RGAA) : rôle img + résumé, et une table de données repliable.
import { useEffect } from 'react';
import { getSelection, onSelection, getFiltre, onFiltre } from './territoireBus';

const COULEUR = '#2f5496';
const PALETTE = ['#2f5496', '#c2571a', '#1e7a46', '#8a3ffc', '#b3261e', '#0ea5e9',
                 '#e0a400', '#d24d87', '#3aa39b', '#6b7280', '#7a4f21', '#4b6b1f'];
let chargement = null;

function chargerECharts() {
  if (window.echarts) return Promise.resolve(window.echarts);
  if (chargement) return chargement;
  chargement = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/echarts/echarts.min.js';
    s.onload = () => resolve(window.echarts);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return chargement;
}

function tableRepli(cfg) {
  const cats = cfg.categories || [];
  const series = cfg.series || [];
  let entete;
  let corps;
  if (cfg.type === 'scatter') {
    entete = `<th>${cfg.xcol || 'X'}</th><th>${cfg.ycol || 'Y'}</th>`;
    corps = (cfg.pairs || []).map(([x, y]) => `<tr><td>${x}</td><td>${y}</td></tr>`).join('');
  } else {
    entete = `<th>${cfg.xcol || 'Catégorie'}</th>`
      + series.map((s) => `<th>${s.name}</th>`).join('');
    corps = cats.map((c, i) =>
      `<tr><td>${c}</td>${series.map((s) => `<td>${s.data[i]}</td>`).join('')}</tr>`).join('');
  }
  const det = document.createElement('details');
  det.className = 'graphique-table';
  det.innerHTML = `<summary>Voir les données du graphique</summary>`
    + `<div class="defilable"><table class="donnees"><thead><tr>${entete}</tr></thead>`
    + `<tbody>${corps}</tbody></table></div>`;
  return det;
}

const fmt = (u) => (v) => `${(typeof v === 'number' ? v : Number(v) || 0)
  .toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${u || ''}`;

function option(cfg) {
  const series = cfg.series || [];
  const multi = series.length > 1;
  const u = cfg.unite || '';
  const base = {
    color: multi ? PALETTE : [cfg.couleur || COULEUR],
    grid: { left: 48, right: 16, top: multi ? 40 : 16, bottom: 90, containLabel: true },
    tooltip: { trigger: cfg.type === 'scatter' ? 'item' : 'axis', valueFormatter: fmt(u) },
    legend: multi ? { top: 0, type: 'scroll' } : undefined,
    textStyle: { fontFamily: 'inherit' },
  };

  if (cfg.type === 'gauge') {
    const max = cfg.max || 100;
    const seuils = cfg.seuils || [];
    // paliers de couleur (seuils de vigilance) sur l'arc de la jauge
    const stops = seuils.length
      ? seuils.map((s) => [Math.min(1, (Number(s.v) || 0) / max), s.c || '#c2571a'])
      : [[0.5, '#1e7a46'], [0.8, '#e0a400'], [1, '#b3261e']];
    return {
      textStyle: { fontFamily: 'inherit' },
      series: [{
        type: 'gauge', min: 0, max, radius: '92%', startAngle: 210, endAngle: -30,
        axisLine: { lineStyle: { width: 14, color: stops } },
        pointer: { width: 5 }, axisTick: { show: false }, splitLine: { length: 10 },
        axisLabel: { fontSize: 9, distance: 12 },
        detail: { valueAnimation: true, fontSize: 22, offsetCenter: [0, '58%'],
                  formatter: (v) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}${u}` },
        title: { offsetCenter: [0, '82%'], fontSize: 11, color: '#6b7280' },
        data: [{ value: cfg.valeur || 0, name: cfg.libelle || '' }],
      }],
    };
  }

  if (cfg.type === 'pie') {
    const data = (cfg.categories || []).map((c, i) => ({ name: c, value: series[0]?.data[i] }));
    return {
      color: PALETTE, tooltip: { trigger: 'item', valueFormatter: fmt(u) },
      legend: { top: 0, type: 'scroll' },
      series: [{ type: 'pie', radius: ['35%', '70%'], data }],
    };
  }
  if (cfg.type === 'scatter') {
    return {
      ...base, color: [cfg.couleur || COULEUR], legend: undefined,
      xAxis: { type: 'value', name: cfg.xcol },
      yAxis: { type: 'value', name: cfg.ycol },
      series: [{ type: 'scatter', symbolSize: 8, data: cfg.pairs || [] }],
    };
  }
  const cats = cfg.categories || [];
  const empile = cfg.empile;
  return {
    ...base,
    xAxis: { type: 'category', data: cats,
             axisLabel: { rotate: cats.length > 6 ? 40 : 0, interval: 0 } },
    yAxis: { type: 'value' },
    series: series.map((s) => ({
      name: s.name, data: s.data,
      type: cfg.type === 'bar' ? 'bar' : 'line',
      stack: empile ? 'total' : (cfg.type === 'area' && multi ? 'total' : undefined),
      areaStyle: cfg.type === 'area' ? {} : undefined,
      smooth: cfg.type !== 'bar',
    })),
  };
}

function messageVide(el, cfg) {
  el.innerHTML = `<p class="graphique-vide meta">${cfg.message || 'Sélectionnez un territoire.'}</p>`;
}

export default function ChartsLoader() {
  useEffect(() => {
    const cibles = [...document.querySelectorAll('.dtz-graphique[data-config]')]
      .filter((el) => !el.dataset.dtzInit);
    if (!cibles.length) return;

    (async () => {
      const echarts = await chargerECharts();

      const lienSource = (el, cfg) => {
        if (!cfg.source || !cfg.source.slug) return;
        const p = document.createElement('p');
        p.className = 'source-lien';
        p.innerHTML = `<a href="/dataset/${encodeURIComponent(cfg.source.slug)}">Source : ${cfg.source.titre}</a>`;
        el.appendChild(p);
      };

      const dessiner = (el, cfg) => {
        el.querySelectorAll('.graphique-toile, .graphique-table, .graphique-vide, .source-lien').forEach((n) => n.remove());
        if (cfg.vide) { messageVide(el, cfg); return; }
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label',
          `${cfg.titre || 'Graphique'} : ${(cfg.categories || cfg.pairs || []).length} valeurs`);
        const toile = document.createElement('div');
        toile.className = 'graphique-toile';
        el.appendChild(toile);
        const chart = echarts.init(toile, null, { renderer: 'svg' });
        chart.setOption(option(cfg), true);
        el._dtzChart = chart;
        window.addEventListener('resize', () => chart.resize());
        // suit aussi le redimensionnement du conteneur (aperçu en iframe, panneaux
        // repliables…), que l'écouteur « resize » de la fenêtre ne couvre pas.
        if (typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(() => chart.resize()).observe(toile);
        }
        if (cfg.type !== 'gauge') el.appendChild(tableRepli(cfg));
        lienSource(el, cfg);
      };

      const charger = async (el, sel) => {
        // rid = jeu du niveau courant (diffusé par le tableau de bord) : un graphe
        // « portée territoire » lit ainsi la donnée du bon niveau (commune/EPCI/…).
        // Le filtre global de page (bloc Filtre) est ajouté s'il est actif (ff/fv) ;
        // la route ne l'applique qu'aux graphes dont le jeu a la colonne concernée.
        const filt = getFiltre();
        const q = `/api/graphique?id=${encodeURIComponent(el.dataset.config)}`
          + (sel?.code ? `&code=${encodeURIComponent(sel.code)}` : '')
          + (sel?.rid ? `&rid=${encodeURIComponent(sel.rid)}` : '')
          + (filt?.field && filt?.value != null && filt.value !== ''
            ? `&ff=${encodeURIComponent(filt.field)}&fv=${encodeURIComponent(filt.value)}` : '');
        const r = await fetch(q);
        if (!r.ok) { el.innerHTML = '<p class="meta">Graphique indisponible.</p>'; return null; }
        const cfg = await r.json();
        dessiner(el, cfg);
        return cfg;
      };

      for (const el of cibles) {
        el.dataset.dtzInit = '1';
        try {
          const cfg = await charger(el, getSelection());
          // graphique réactif : se recompose à chaque changement de sélection territoire
          if (cfg && cfg.reactif) {
            onSelection((s) => { charger(el, s).catch(() => {}); });
          }
          // tout graphique suit le filtre global de page (re-fetch ; sans effet si son
          // jeu n'a pas la colonne filtrée, la route renvoie alors la donnée complète).
          onFiltre(() => { charger(el, getSelection()).catch(() => {}); });
        } catch {
          el.innerHTML = '<p class="meta">Graphique indisponible.</p>';
        }
      }
    })();
  });
  return null;
}
