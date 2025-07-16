// src/index.js
import { Router } from 'itty-router';
import { WorkOS } from '@workos-inc/node';
import { WorkerEntrypoint } from 'cloudflare:workers';

const router = Router();

router.get('/api/auth', async (request, env) => {
    const workos = new WorkOS(env.WORKOS_API_KEY);
    const workerUrl = new URL(request.url);
    const redirectUri = `${workerUrl.origin}/api/callback`;

    const authorizationUrl = workos.sso.getAuthorizationUrl({
        organization: env.WORKOS_ORG_ID,
        clientId: env.WORKOS_CLIENT_ID,
        redirectUri,
    });

    return Response.redirect(authorizationUrl, 302);
});

const renderBody = (status, content) => {
    const html = `
    <script>
      const receiveMessage = (message) => {
        window.opener.postMessage(
          'authorization:github:${status}:${JSON.stringify(content)}',
          message.origin
        );
        window.removeEventListener("message", receiveMessage, false);
      }
      window.addEventListener("message", receiveMessage, false);
      window.opener.postMessage("authorizing:github", "*");
    </script>
    `;
    return new Blob([html]);
};

router.get('/api/callback', async (request, env) => {
    const workos = new WorkOS(env.WORKOS_API_KEY);
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
        return new Response('Authentication failed: No code provided.', {
            status: 400,
        });
    }

    try {
        const { profile } = await workos.sso.getProfileAndToken({
            code,
            clientId: env.WORKOS_CLIENT_ID,
        });

        if (profile.organizationId !== env.WORKOS_ORG_ID) {
            return new Response(
                'Access Denied: User is not part of the required organization.',
                { status: 403 }
            );
        }

        const body = renderBody('success', {
            token: env.DECAP_CMS_GITHUB_TOKEN,
            provider: 'github',
        });

        return new Response(body, {
            headers: {
                'content-type': 'text/html;charset=UTF-8',
            },
            status: 200,
        });
    } catch (error) {
        console.error('WorkOS authentication error:', error.message);
        return new Response('Authentication failed.', { status: 500 });
    }
});

router.all('*', async (request, env) => await env.ASSETS.fetch(request));

export default class extends WorkerEntrypoint {
    async fetch(request) {
        return router.fetch(request, this.env, this.ctx);
    }
}
