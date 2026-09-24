package com.echorelay.game;

import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import androidx.test.espresso.web.webdriver.Locator;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.*;
import static org.hamcrest.Matchers.*;
import static org.junit.Assert.*;

/** Runs against the installed app's native views and real Android WebView, never the game model. */
@RunWith(AndroidJUnit4.class)
public class GameJourneyTest {
    private ActivityScenario<MainActivity> scenario;
    private UiDevice device;
    @Before public void launch() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        scenario = ActivityScenario.launch(MainActivity.class);
    }
    @After public void finish() throws Exception {
        capture("last-screen");
        device.unfreezeRotation();
        if (scenario != null) scenario.close();
    }
    private void step(String text) {
        Bundle status = new Bundle(); status.putString("stream", "\nECHO_TEST: " + text + "\n");
        InstrumentationRegistry.getInstrumentation().sendStatus(0, status);
    }
    private String text(String selector) {
        return onWebView().withElement(findElement(Locator.CSS_SELECTOR, selector)).perform(getText()).get();
    }
    private void waitFor(String selector, String expected) {
        long end = SystemClock.elapsedRealtime() + 90000;
        Throwable last = null;
        while (SystemClock.elapsedRealtime() < end) {
            try { if (text(selector).contains(expected)) return; }
            catch (RuntimeException | AssertionError error) { last = error; }
            SystemClock.sleep(350);
        }
        throw new AssertionError("Timed out waiting for " + selector + " containing " + expected, last);
    }
    private void tap(String selector) {
        onWebView().withElement(findElement(Locator.CSS_SELECTOR, selector)).perform(webClick());
    }
    private void type(String selector, String value) {
        onWebView().withElement(findElement(Locator.CSS_SELECTOR, selector)).perform(clearElement()).perform(webKeys(value));
    }
    private void enabledThenTap(String id) {
        waitFor("#" + id + ":not([disabled])", ""); tap("#" + id);
    }
    private void swap() { tap("[data-action='practice-swap']"); }
    private void walk(String station) {
        tap(".travel-spot[data-station='" + station + "']");
        waitFor(".travel-spot.is-near[data-station='" + station + "']", "");
    }
    private void capture(String name) {
        // Let decoded artwork reach the surface before collecting visual evidence.
        device.waitForIdle(1000);
        SystemClock.sleep(750);
        File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "e2e");
        directory.mkdirs();
        device.takeScreenshot(new File(directory, name + ".png"));
    }
    private void say(String value) {
        type("#chat-input", value.replaceAll("\\s+", " ")); tap("#chat-form button[type='submit']"); step(value);
    }
    private void connect(String address) {
        onView(withId(R.id.server_url)).perform(scrollTo(), replaceText(address), closeSoftKeyboard());
        onView(withId(R.id.connect_button)).perform(scrollTo(), click());
    }

    @Test public void offlineAllChambersWithLifecycleAndReplay() throws Exception {
        step("Native launcher"); capture("01-launcher");
        onView(withId(R.id.offline_button)).perform(scrollTo(), click());
        waitFor("h1", "The Root Bridge"); capture("02-offline-past");
        step("Offline bridge; preserve state through rotation and background");
        waitFor("#journey-guide", "Give the tree water");
        tap("#journey-guide [data-action='walk-to']");
        waitFor("#journey-guide [data-action='water']", "Choose Grow");
        tap("#journey-guide [data-action='water']");
        waitFor("#journey-guide", "Future’s turn");
        device.setOrientationLeft();
        waitFor("#water-grow[aria-pressed='true']", "Grow"); capture("03-landscape");
        device.setOrientationNatural();
        device.pressHome();
        Intent resume = InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageManager()
                .getLaunchIntentForPackage("com.echorelay.game.debug");
        resume.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(resume);
        waitFor("#water-grow[aria-pressed='true']", "Grow");
        device.pressBack();
        onView(withText(R.string.leave_title)).check(matches(isDisplayed()));
        onView(withText(R.string.stay)).perform(click());
        swap(); walk("roots"); waitFor("#controls", "Grown");
        tap("#anchor-action"); swap();
        waitFor("#journey-guide", "Now choose Drain");
        tap("#journey-guide [data-action='water']");
        swap(); walk("gate"); enabledThenTap("cross");
        waitFor("h1", "The Clockwork Lift"); capture("04-offline-workshop");
        walk("blueprint"); String gear = text("[data-testid='gear-clue']").toLowerCase(Locale.ROOT);
        String shape = gear.contains("triangle") ? "triangle" : gear.contains("diamond") ? "diamond" : "circle";
        swap(); walk("bearing"); tap("#gear-" + shape); swap(); walk("drive"); waitFor("#controls", "Working");
        tap("#anchor-action"); swap(); walk("power"); tap("#power-lift"); swap(); walk("lift"); enabledThenTap("ride");
        waitFor("h1", "The Last Light"); capture("05-offline-observatory");
        walk("stars"); String clue = text("[data-testid='constellation-clue']").toLowerCase(Locale.ROOT);
        Matcher symbols = Pattern.compile("sun|moon|star|wave").matcher(clue);
        String[] target = new String[3]; int i = 0;
        while (symbols.find() && i < 3) target[i++] = symbols.group();
        assertEquals("Visible constellation must contain three symbols", 3, i);
        swap(); walk("rings"); for (i = 0; i < 3; i++) tap("#ring-" + target[i] + "-" + i);
        swap(); walk("lens"); waitFor("#controls", "Charged"); tap("#anchor-action");
        swap(); walk("beam"); tap("#beam-portal"); walk("portal"); enabledThenTap("pulse");
        waitFor("#pulse", "Your pulse is waiting"); swap(); walk("portal"); enabledThenTap("pulse");
        waitFor("h1", "The Moonlit Canal"); capture("11-offline-canal"); walk("chart");
        String tide = text("[data-testid='tide-clue']");
        Matcher mark = Pattern.compile("Mark ([123])").matcher(tide); assertTrue("Safe tide is visible", mark.find());
        String safeTide = mark.group(1);
        swap(); walk("sluice"); tap("#tide-" + safeTide); swap(); walk("boat"); waitFor("#controls", "Afloat"); tap("#anchor-action");
        swap(); walk("mooring"); tap("#mooring-release"); swap(); walk("jetty"); enabledThenTap("sail");
        waitFor("h1", "The Storm Tower"); capture("12-offline-tower"); walk("map");
        String heading = text("[data-testid='heading-clue']").toLowerCase(Locale.ROOT);
        String direction = heading.contains("east") ? "east" : heading.contains("west") ? "west" : "north";
        swap(); walk("compass"); tap("#heading-" + direction); swap(); walk("beacon"); waitFor("#controls", "Lit"); tap("#anchor-action");
        swap(); walk("shutter"); tap("#shutter-open"); swap(); walk("skybridge"); enabledThenTap("ascend");
        waitFor("h1", "The Reunion Garden"); capture("13-offline-reunion"); walk("meeting"); enabledThenTap("meet");
        swap(); walk("meeting"); enabledThenTap("meet");
        waitFor("h1", "You brought each other home."); capture("06-offline-ending");
        step("Offline ending verified; replay");
        tap("[data-action='replay']"); waitFor("h1", "The Root Bridge");
        onView(withId(R.id.menu_button)).perform(click());
        onView(withText(R.string.return_menu)).perform(click());
        onView(withId(R.id.offline_button)).check(matches(isDisplayed()));
        step("PASS offline six-destination journey, walking/proximity, reunion, rotation, background, back confirmation, replay and menu");
    }

    @Test public void invalidAddressAndConnectionRecovery() {
        onView(withId(R.id.server_url)).perform(scrollTo(), replaceText("file:///private"), closeSoftKeyboard());
        onView(withId(R.id.connect_button)).perform(scrollTo(), click());
        onView(withId(R.id.server_url)).check(matches(hasErrorText(containsString("address"))));
        connect("http://127.0.0.1:1");
        long end = SystemClock.elapsedRealtime() + 35000;
        while (!device.hasObject(androidx.test.uiautomator.By.text("Could not reach the relay")) && SystemClock.elapsedRealtime() < end) SystemClock.sleep(250);
        onView(withText(R.string.connection_error)).check(matches(isDisplayed())); capture("07-connection-error");
        onView(withText(R.string.retry)).perform(click());
        end = SystemClock.elapsedRealtime() + 35000;
        while (!device.hasObject(androidx.test.uiautomator.By.text("Could not reach the relay")) && SystemClock.elapsedRealtime() < end) SystemClock.sleep(250);
        onView(withText(R.string.return_menu)).perform(click());
        onView(withId(R.id.offline_button)).perform(scrollTo(), click());
        waitFor("h1", "The Root Bridge");
        step("PASS invalid address, unreachable server, retry and offline recovery");
    }

    /** Partner is another real UI client. Test progress and clue messages coordinate the run. */
    @Test public void onlineFutureWithBrowserPartner() {
        Bundle arguments = InstrumentationRegistry.getArguments();
        String room = arguments.getString("relayRoom", "");
        org.junit.Assume.assumeTrue("Supply relayRoom and a live browser partner", room.matches("[A-HJ-NP-Z2-9]{6}"));
        String server = arguments.getString("relayServer", "http://127.0.0.1:8788");
        connect(server + "/?room=" + room);
        waitFor("#nickname", ""); type("#nickname", "Android Emulator"); tap("#entry-form button[type='submit']");
        waitFor("#ready", "Ready"); tap("#ready"); waitFor("h1", "The Root Bridge");
        capture("08-online-bridge");
        walk("roots"); tap("#anchor-action"); waitFor("#anchor-action", "stump");
        waitFor(".travel-spot[data-station='gate'][disabled]", "Garden gate"); tap("#anchor-action");
        say("Android ready: choose Grow.");
        waitFor("#controls", "Grown"); tap("#anchor-action");
        say("Bridge anchored. Choose Drain."); waitFor(".travel-spot[data-station='gate']:not([disabled])", "Garden gate"); walk("gate"); enabledThenTap("cross");
        waitFor("h1", "The Clockwork Lift");
        step("Recreate the Android activity and reconnect to the saved multiplayer checkpoint");
        scenario.recreate(); waitFor("h1", "The Clockwork Lift");
        waitFor(".connection.connected", "Relay connected");
        onView(withId(R.id.menu_button)).perform(click());
        onView(withText(R.string.return_menu)).perform(click());
        connect(server + "/?room=" + room);
        waitFor("h1", "The Clockwork Lift"); waitFor(".connection.connected", "Relay connected");
        capture("09-reconnected-workshop");
        walk("blueprint"); say("Blueprint: " + text("[data-testid='gear-clue']"));
        walk("drive"); waitFor("#controls", "Working"); tap("#anchor-action");
        say("Drive anchored. Route power to Lift."); walk("lift"); enabledThenTap("ride");
        waitFor("h1", "The Last Light"); capture("09-online-observatory");
        walk("stars"); say("Constellation: " + text("[data-testid='constellation-clue']"));
        walk("lens"); waitFor("#controls", "Charged"); tap("#anchor-action");
        say("Lens anchored. Route light to Portal.");
        walk("portal"); enabledThenTap("pulse");
        say("My portal pulse is sent. Send yours.");
        waitFor("h1", "The Moonlit Canal"); walk("chart"); say("Tide: " + text("[data-testid='tide-clue']"));
        walk("boat"); waitFor("#controls", "Afloat"); tap("#anchor-action"); say("Skiff anchored. Release the mooring."); walk("jetty"); enabledThenTap("sail");
        waitFor("h1", "The Storm Tower"); walk("map"); say("Direction: " + text("[data-testid='heading-clue']"));
        walk("beacon"); waitFor("#controls", "Lit"); tap("#anchor-action"); say("Beacon anchored. Open the sky route."); walk("skybridge"); enabledThenTap("ascend");
        waitFor("h1", "The Reunion Garden"); walk("meeting"); enabledThenTap("meet"); say("I reached our circle. Walk here and choose I am here.");
        waitFor("h1", "You brought each other home."); capture("10-online-ending");
        step("PASS online six-destination walking journey and reunion with browser partner");
    }
}
