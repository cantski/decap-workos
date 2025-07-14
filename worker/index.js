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
        provider: 'authkit',
        clientID: env.WORKOS_CLIENT_ID,
        redirectURI: redirectUri,
    });

    return Response.redirect(authorizationUrl, 302);
});

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
            clientID: env.WORKOS_CLIENT_ID,
        });

        if (profile.organizationId !== env.WORKOS_ORG_ID) {
            return new Response(
                'Access Denied: User is not part of the required organization.',
                { status: 403 }
            );
        }

        const githubToken = env.DECAP_CMS_GITHUB_TOKEN;

        const decapRedirect = new URL(env.DECAP_SITE_URL);
        decapRedirect.hash = `#auth={"token":"${githubToken}","provider":"external"}`;

        return Response.redirect(decapRedirect.toString(), 302);
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
