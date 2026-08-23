package uk.co.bouncecore.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class BouncecoreFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BouncecorePush";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        RemoteMessage.Notification notification = message.getNotification();
        String title = notification != null && notification.getTitle() != null ? notification.getTitle() : "Bouncecore";
        String body = notification != null && notification.getBody() != null ? notification.getBody() : "";
        String actionUrl = message.getData().get("actionUrl");

        showNotification(title, body, actionUrl);
    }

    @Override
    public void onNewToken(String token) {
        getSharedPreferences(MainActivity.PUSH_PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putString(MainActivity.PREF_FCM_TOKEN, token)
            .apply();
        Log.d(TAG, "FCM token refreshed and saved for registration on the next authenticated app launch.");
    }

    private void showNotification(String title, String body, String actionUrl) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        NotificationChannels.ensureDefaultChannel(this);

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (actionUrl != null && !actionUrl.trim().isEmpty()) {
            intent.putExtra(MainActivity.EXTRA_NOTIFICATION_ACTION_URL, actionUrl.trim());
        }

        int notificationId = (int) System.currentTimeMillis();
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, NotificationChannels.DEFAULT_CHANNEL_ID)
            : new Notification.Builder(this);

        builder
            .setAutoCancel(true)
            .setColor(Color.parseColor("#00d4ff"))
            .setContentIntent(pendingIntent)
            .setContentText(body)
            .setContentTitle(title)
            .setSmallIcon(R.drawable.ic_launcher);

        manager.notify(notificationId, builder.build());
    }
}
