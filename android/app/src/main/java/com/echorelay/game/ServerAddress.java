package com.echorelay.game;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/** Only explicit HTTPS servers, or numeric private IPv4 addresses in test builds. */
final class ServerAddress {
    static String normalize(String input, boolean allowLan) {
        try {
            URI uri = new URI(input.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost();
            if (host == null || uri.getRawUserInfo() != null || uri.getRawFragment() != null
                    || uri.getPort() == 0 || uri.getPort() > 65535 || uri.getPort() < -1)
                throw new IllegalArgumentException("Enter a complete server address, including http:// or https://.");
            if (!scheme.equals("https") && !(allowLan && scheme.equals("http") && isLocalHost(host)))
                throw new IllegalArgumentException(allowLan
                        ? "Use HTTPS, or http:// with your computer’s private Wi-Fi IP address."
                        : "This build requires an HTTPS game server.");
            if (host.equalsIgnoreCase("appassets.androidplatform.net"))
                throw new IllegalArgumentException("That address is reserved for offline practice.");
            if (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/"))
                throw new IllegalArgumentException("Use the server’s main address, without a page path.");
            String query = uri.getRawQuery();
            if (query != null && !query.matches("room=[A-HJ-NP-Z2-9]{6}"))
                throw new IllegalArgumentException("Use a server address or a valid six-character room invitation.");
            return new URI(scheme, null, host.toLowerCase(Locale.ROOT), uri.getPort(), "/", query, null).toASCIIString();
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("That address could not be read. Check it and try again.");
        }
    }

    static boolean sameOrigin(String first, String second) {
        try {
            URI a = new URI(first), b = new URI(second);
            return a.getHost() != null && b.getHost() != null && b.getRawUserInfo() == null
                    && a.getScheme().equalsIgnoreCase(b.getScheme())
                    && a.getHost().equalsIgnoreCase(b.getHost()) && effectivePort(a) == effectivePort(b);
        } catch (URISyntaxException | NullPointerException e) { return false; }
    }

    private static int effectivePort(URI uri) {
        return uri.getPort() != -1 ? uri.getPort() : ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80);
    }

    private static boolean isLocalHost(String host) {
        if (host.equalsIgnoreCase("localhost")) return true;
        String[] parts = host.split("\\.", -1);
        if (parts.length != 4) return false;
        int[] octets = new int[4];
        for (int i = 0; i < 4; i++) {
            if (!parts[i].matches("0|[1-9][0-9]{0,2}")) return false;
            octets[i] = Integer.parseInt(parts[i]);
            if (octets[i] > 255) return false;
        }
        return octets[0] == 10 || octets[0] == 127
                || (octets[0] == 192 && octets[1] == 168)
                || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31);
    }
}
