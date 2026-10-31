/**
 * Cloudflare Turnstile ("are you human") for sign-up and password reset, same check as the website.
 * A hidden web view runs the check; it only shows when Cloudflare needs a tap.
 */
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '@/theme';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFnC32eIvhw1X1Zf';
// The site key is registered for the website's domain.
const BASE_URL = 'https://mediarca.in';
const TIMEOUT_MS = 60000;

type Pending = { resolve: (token?: string) => void };
let pending: Pending | null = null;
let notify: ((active: boolean) => void) | null = null;

/** A one-time token, or undefined if the check couldn't run (the server then explains). */
export const getBotCheckToken = (): Promise<string | undefined> =>
  new Promise((resolve) => {
    if (!notify) return resolve(undefined);
    pending?.resolve(undefined);
    const timer = setTimeout(() => finish(undefined), TIMEOUT_MS);
    pending = {
      resolve: (token) => {
        clearTimeout(timer);
        resolve(token);
      },
    };
    notify(true);
  });

const finish = (token?: string) => {
  const current = pending;
  pending = null;
  notify?.(false);
  current?.resolve(token);
};

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=go&render=explicit" async></script>
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center;align-items:center;height:100%}</style>
</head><body><div id="c"></div><script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function go(){turnstile.render('#c',{sitekey:'${SITE_KEY}',appearance:'interaction-only',theme:'light',
 'before-interactive-callback':function(){send({show:true});},
 callback:function(t){send({token:t});},
 'error-callback':function(){send({error:true});},
 'expired-callback':function(){send({error:true});},
 'timeout-callback':function(){send({error:true});}});}
</script></body></html>`;

/** Mount once near the root of the app. */
export function BotCheckHost() {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    notify = (on) => {
      setActive(on);
      if (!on) setVisible(false);
    };
    return () => {
      notify = null;
    };
  }, []);

  if (!active) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => finish(undefined)}>
      <View style={[styles.backdrop, !visible && styles.hidden]}>
        <View style={styles.box}>
          <WebView
            source={{ html, baseUrl: BASE_URL }}
            originWhitelist={['*']}
            javaScriptEnabled
            style={styles.web}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.show) setVisible(true);
                else if (msg.token) finish(msg.token);
                else if (msg.error) finish(undefined);
              } catch {
                finish(undefined);
              }
            }}
            onError={() => finish(undefined)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  hidden: { opacity: 0 },
  box: { width: 320, height: 90, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.card },
  web: { backgroundColor: 'transparent' },
});
