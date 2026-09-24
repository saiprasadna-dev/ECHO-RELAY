package com.echorelay.game;

import org.junit.Test;
import static org.junit.Assert.*;

public class ServerAddressTest {
    @Test public void acceptsPrivateWifiAndRoomInvitationsInDebug() {
        assertEquals("http://192.168.29.195:8788/", ServerAddress.normalize(" http://192.168.29.195:8788 ", true));
        assertEquals("http://10.0.2.2:8787/?room=ABC234", ServerAddress.normalize("http://10.0.2.2:8787/?room=ABC234", true));
        assertEquals("http://172.16.1.2/", ServerAddress.normalize("http://172.16.1.2", true));
        assertEquals("http://localhost:8787/", ServerAddress.normalize("http://localhost:8787", true));
    }
    @Test public void releaseRequiresHttps() {
        assertEquals("https://relay.example/", ServerAddress.normalize("HTTPS://Relay.Example", false));
        assertThrows(IllegalArgumentException.class, () -> ServerAddress.normalize("http://192.168.1.2", false));
    }
    @Test public void rejectsUnsafeAndAmbiguousAddresses() {
        for (String value : new String[]{"", "192.168.1.2:8787", "file:///etc/passwd", "javascript:alert(1)",
                "http://8.8.8.8", "http://192.168.1.2.evil.test", "http://172.32.1.1", "http://192.168.999.1",
                "http://192.168.01.2", "https://user:secret@example.com", "https://example.com:99999",
                "https://example.com:0", "https://example.com/page", "https://example.com/#x",
                "https://example.com/?room=ABC234&other=1", "https://appassets.androidplatform.net"})
            assertThrows(value, IllegalArgumentException.class, () -> ServerAddress.normalize(value, true));
    }
    @Test public void originGateChecksSchemeHostAndEffectivePort() {
        assertTrue(ServerAddress.sameOrigin("https://relay.example/", "https://relay.example:443/assets/a.webp"));
        assertTrue(ServerAddress.sameOrigin("http://192.168.1.2:8788/", "http://192.168.1.2:8788/api/rooms"));
        assertFalse(ServerAddress.sameOrigin("https://relay.example", "http://relay.example"));
        assertFalse(ServerAddress.sameOrigin("http://192.168.1.2:8788/", "http://192.168.1.2:8787/"));
        assertFalse(ServerAddress.sameOrigin("https://relay.example", "https://relay.example.evil.test"));
        assertFalse(ServerAddress.sameOrigin("https://relay.example", "https://user@relay.example"));
        assertFalse(ServerAddress.sameOrigin("https://relay.example", "file:///tmp/a.html"));
    }
}
