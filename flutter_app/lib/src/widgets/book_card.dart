import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../features/books/domain/entities/book.dart';
import '../theme.dart';

class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book, required this.onTap});
  final Book book;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 138,
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
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 3),
          Text(
            '${book.language}  •  ${book.accessType}',
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
      ),
    ),
  );
}
