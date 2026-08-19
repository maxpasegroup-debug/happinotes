import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';
import 'loading_skeleton.dart';

class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book, required this.onTap});
  final Book book;
  final VoidCallback onTap;

  static double cardWidth(BuildContext context) =>
      (MediaQuery.sizeOf(context).width * .36).clamp(124.0, 152.0);

  static double shelfHeight(BuildContext context) {
    final scaler = MediaQuery.textScalerOf(context);
    final coverHeight = cardWidth(context) / .72;
    final titleHeight = scaler.scale(18) * 2;
    final metadataHeight = scaler.scale(13);
    return coverHeight + titleHeight + metadataHeight + 25;
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: cardWidth(context),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: .72,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: book.coverImageUrl.isEmpty
                  ? Container(
                      color: AppColors.raised,
                      child: Center(
                        child: Text(
                          book.title.isEmpty ? '?' : book.title[0],
                          style: const TextStyle(
                            fontSize: 42,
                            color: AppColors.coral,
                          ),
                        ),
                      ),
                    )
                  : CachedNetworkImage(
                      imageUrl: book.coverImageUrl,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => const SkeletonBox(
                        height: double.infinity,
                        radius: 12,
                      ),
                      errorWidget: (context, url, error) =>
                          const ColoredBox(color: AppColors.raised),
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            book.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 14,
              height: 1.2,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            '${book.language}  •  ${book.accessType}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              height: 1.2,
              color: AppColors.muted,
            ),
          ),
        ],
      ),
    ),
  );
}
