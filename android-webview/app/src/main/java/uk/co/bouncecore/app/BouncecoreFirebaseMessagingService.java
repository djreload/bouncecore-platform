package uk.co.bouncecore.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class BouncecoreFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "bouncecore_notifications";
    private static final String TAG = "BouncecorePush";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        RemoteMessage.Notification notification = message.getNotification();
        String title = notification != null && notification.getTitle() != null ? notification.getTitle() : "Bouncecore";
        String body = notification != null && notification.getBody() != null ? notification.getBody() : "";

        showNotification(title, body);
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "FCM token refreshed. It will be registered on next authenticated app launch.");
    }

    private void showNotification(String title, String body) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        ensureNotificationChannel(manager);

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        builder
            .setAutoCancel(true)
            .setColor(Color.parseColor("#00d4ff"))
            .setContentIntent(pendingIntent)
            .setContentText(body)
            .setContentTitle(title)
            .setSmallIcon(R.drawable.ic_launcher);

        manager.notify((int) System.currentTimeMillis(), builder.build());
    }

    private void ensureNotificationChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Bouncecore notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Account, stream, shop, music, and admin notifications.");
        manager.createNotificationChannel(channel);
    }
}
