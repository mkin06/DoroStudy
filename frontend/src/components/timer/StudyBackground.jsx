import { memo, useState } from 'react';
import backgroundImage from '../../assets/background.jpg';
import './StudyBackground.css';

function youtubeId(url = '') {
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)?.[1] || null;
}

// A stable pattern avoids moving every particle whenever the timer ticks.
function Rain() {
  return <div className="study-rain">{Array.from({ length: 80 }, (_, i) => <i key={i} style={{
    left: `${(i * 37.7) % 100}%`, animationDelay: `${-(i * .31) % 2}s`,
    animationDuration: `${.8 + (i % 6) * .1}s`, opacity: .3 + (i % 5) * .1,
  }} />)}</div>;
}

function StudyBackground({ scene }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const [readyUrl, setReadyUrl] = useState(null);
  const ytId = scene.type === 'video' ? youtubeId(scene.url) : null;
  const fallback = scene.thumbnail || (scene.type === 'image' ? scene.url : '') || backgroundImage;
  const opacity = Math.max(0, Math.min(.9, Number(scene.opacity) || 0));
  return <div className="study-background" aria-hidden="true" data-scene={scene.id}>
    <div className="study-background-image" style={{ backgroundImage: `url(${JSON.stringify(fallback)})` }} />
    {scene.type === 'video' && failedUrl !== scene.url && (ytId
      ? <iframe key={scene.url} className="study-background-youtube" title="Background video"
        src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&playsinline=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1`}
        allow="autoplay; encrypted-media" tabIndex={-1} style={{ opacity: readyUrl === scene.url ? 1 : 0 }}
        onLoad={() => setReadyUrl(scene.url)} onError={() => setFailedUrl(scene.url)} />
      : <video key={scene.url} className="study-background-video" src={scene.url} poster={fallback}
        autoPlay loop muted playsInline style={{ opacity: readyUrl === scene.url ? 1 : 0 }}
        onCanPlay={() => setReadyUrl(scene.url)} onError={() => setFailedUrl(scene.url)} />)}
    {['rain', 'storm'].includes(scene.weather) && <Rain />}
    {scene.weather === 'snow' && <div className="study-snow">{Array.from({ length: 60 }, (_, i) => <i key={i} style={{
      left: `${(i * 37.7) % 100}%`, animationDelay: `${-(i * .71) % 5}s`,
      animationDuration: `${3 + (i % 9) * .5}s`, width: `${3 + i % 5}px`, height: `${3 + i % 5}px`, opacity: .5 + (i % 5) * .1,
    }} />)}</div>}
    {scene.weather === 'storm' && <div className="study-lightning" />}
    <div className="study-background-shade" style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }} />
  </div>;
}

export default memo(StudyBackground);
