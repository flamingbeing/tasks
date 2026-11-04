// The signed-out screen (#signed-out): the kit's sign-in screen, with "Forget this device" while a copy is kept.
import { signInScreen } from '@core/ui';
import { $, sectionScreen } from '../dom.js';

/**
 * @param {import('../cloud.js').Started} app
 * @param {{ onForget: (ok: boolean) => void }} o  told whether this device was forgotten
 */
export function signedOutScreen(app, { onForget }) {
  signInScreen($('signed-out'), {
    name: 'Tasks',
    tagline: 'Today, upcoming and done, in your own lists.',
    icon: 'icons/icon.svg',
    accent: '#5a88b8',
    auth: app.auth,
    onForget,
  });
  return sectionScreen('signed-out');
}
