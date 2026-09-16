interface Section {
  title: string;
  items: { name: string; meta?: string; desc?: string }[];
}

const basics = {
  name: '吴八哥',
  title: '前端开发工程师',
  contact: ['邮箱: lpw94@example.com', 'GitHub: github.com/lpw94', '城市: 中国'],
  summary:
    '6 年前端开发经验，专注于数据可视化大屏、React 工程化与复杂交互实现。熟悉能源/工业物联网场景下的实时监控前端，注重性能与可维护性。',
};

const skills: Section = {
  title: '技能专长',
  items: [
    { name: '前端框架', meta: 'React / Vue / TypeScript', desc: 'UMiJS、Next.js、dva/redux 状态管理' },
    { name: '可视化', meta: 'ECharts / Three.js / D3', desc: '3D 地球、大屏可视化、WebGL 动效' },
    { name: '工程化', meta: 'Vite / Webpack / CI-CD', desc: 'GitLab CI、Docker、Nginx 部署' },
    { name: '其他', meta: 'Node.js / WebSocket / i18n', desc: '实时通信、国际化、Electron' },
  ],
};

const experience: Section = {
  title: '工作经历',
  items: [
    {
      name: '富能智慧运维大屏',
      meta: '前端负责人 · 2023 - 至今',
      desc: '负责能源与设备监控模块，主导 3D 地球、园区视图与四类能源数据看板，落地 ARM64 容器化部署。',
    },
    {
      name: '智慧水务大屏',
      meta: '前端开发 · 2022 - 2023',
      desc: '集成 ChatBot 组件（语音输入、可拖拽悬浮窗、桌面宠物动效），基于 Three.js 渲染园区 3D 地图。',
    },
  ],
};

const education: Section = {
  title: '教育背景',
  items: [{ name: '计算机科学与技术', meta: '本科 · 2015 - 2019' }],
};

function Block({ section }: { section: Section }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-900 border-l-4 border-brand pl-3 mb-4">
        {section.title}
      </h2>
      <div className="space-y-4">
        {section.items.map((it, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h3 className="font-medium text-slate-800">{it.name}</h3>
              {it.meta && <span className="text-sm text-slate-400">{it.meta}</span>}
            </div>
            {it.desc && <p className="mt-1 text-sm text-slate-600">{it.desc}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Resume() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-sm">
      <header className="text-center border-b border-slate-100 pb-6 mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{basics.name}</h1>
        <p className="mt-1 text-brand font-medium">{basics.title}</p>
        <p className="mt-3 text-sm text-slate-500">{basics.contact.join(' · ')}</p>
        <p className="mt-4 text-slate-600 leading-relaxed">{basics.summary}</p>
      </header>

      <div className="space-y-10">
        <Block section={skills} />
        <Block section={experience} />
        <Block section={education} />
      </div>

      <p className="mt-10 text-center text-xs text-slate-400">
        本简历内容可在 src/pages/Resume.tsx 中直接编辑
      </p>
    </div>
  );
}
