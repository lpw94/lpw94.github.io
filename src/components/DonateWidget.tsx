import { useState } from 'react'

// 把你的收款码图片放到 public/ 下（支持 png/jpg/svg），改这里的路径即可
const QR_CODES = {
  wechat: { label: '微信', src: '/wx.png', tip: '支持一下宝马油钱。' },
  alipay: { label: '支付宝', src: '/zfb.png', tip: '支持一下房子首付' },
} as const

type PayKey = keyof typeof QR_CODES

/** 支持收款：微信 / 支付宝二维码切换卡片 */
export default function DonateWidget() {
  const [tab, setTab] = useState<PayKey>('wechat')
  const cur = QR_CODES[tab]

  return (
    <section className="widget-card donate-widget" aria-label="支持收款">
      {/* <div className="ww-title">大爷支持一下</div> */}
      <div className="dw-tabs">
        {(Object.keys(QR_CODES) as PayKey[]).map((k) => (
          <button
            key={k}
            className={`dw-tab dw-${k}${tab === k ? ' active' : ''}`}
            onClick={() => setTab(k)}
          >
            {QR_CODES[k].label}
          </button>
        ))}
      </div>
      <div className="dw-qr">
        <img src={cur.src} alt={`${cur.label}收款码`} draggable={false} />
      </div>
      <div className="dw-tip">{cur.tip}</div>
    </section>
  )
}
