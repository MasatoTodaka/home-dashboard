import { useEffect } from 'react';

// Screen Wake Lock API で画面の減光・スリープを止める。
// Chromeで表示しているとOSのスリープ設定どおりに暗くなってしまうため (Fully Kiosk Browser なら不要)。
// ページが裏に回るとブラウザが自動で解除するので、表示に戻ったタイミングで取り直す
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return undefined;

    let sentinel = null;
    let retryTimer = null;
    let requesting = false;
    let disposed = false;

    async function acquire() {
      if (disposed || sentinel || requesting || document.visibilityState !== 'visible') return;
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        // 取得待ちの間にアンマウントされていたら、保持せずすぐ解放する
        if (disposed) {
          lock.release();
          return;
        }
        sentinel = lock;
        sentinel.addEventListener('release', () => {
          sentinel = null;
          if (disposed) return;
          // 省電力モード等でOS側から解除された場合に備え、表示中なら少し待って取り直す
          clearTimeout(retryTimer);
          retryTimer = setTimeout(acquire, 60 * 1000);
        });
      } catch (err) {
        console.warn('Wake Lock を取得できませんでした:', err);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(acquire, 60 * 1000);
      } finally {
        requesting = false;
      }
    }

    acquire();
    document.addEventListener('visibilitychange', acquire);

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', acquire);
      sentinel?.release();
    };
  }, []);
}
